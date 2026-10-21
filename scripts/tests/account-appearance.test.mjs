import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { sharedGroupFixture } from "../fixtures/shared-groups-test.mjs";
import { describeSnapshot, verifySnapshot } from "../d1-backup-policy.mjs";

const migration = readFileSync(new URL("../../drizzle/0018_account_appearance.sql", import.meta.url), "utf8");
const identity = (memberId = 1) => ({ memberId, sessionVersion: 1 });
function fixture() {
  const f = sharedGroupFixture(); f.sql.exec(migration);
  f.env.SELF_SERVICE_LOCAL = "true"; delete f.env.AUTH_PROVIDER;
  const preference = f.load("db/account-appearance");
  const save = (id, scheme = "minimal", mode = "light", groupId = null) => preference.saveAccountAppearance(identity(id), { kind: "appearance", scheme, mode }, groupId);
  const state = (id) => f.load("db/account-experience").readAccountExperience(id);
  return { ...f, ...preference, save, experience: state };
}

test("account appearance migration preserves all previous content, hashes, schema and memberships", async () => {
  const f = sharedGroupFixture();
  try {
    const before = describeSnapshot(f.sql); f.sql.exec(migration); const after = describeSnapshot(f.sql);
    await verifySnapshot({ ...before, schemaDigest: after.schemaDigest }, async sql => f.sql.prepare(sql).all());
    for (const old of before.schema) assert.deepEqual(after.schema.find(row => row.name === old.name), old);
    assert.equal(after.tables.length, before.tables.length + 1);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM account_appearance").get().n, 0);
  } finally { f.close(); }
});

test("old schema retains tour completion and notebook/system group defaults", async () => {
  const f = sharedGroupFixture();
  try {
    assert.deepEqual(await f.load("db/account-appearance").initialAccountAppearance(1), { scheme: "notebook", mode: "system" });
    const experience = f.load("db/account-experience");
    assert.equal((await experience.readAccountExperience(1)).appearanceAvailable, false);
    await experience.saveAccountTour(1, { version: 1, state: "completed" });
    assert.equal((await experience.readAccountExperience(1)).tour.state, "completed");
    const created = await f.create(1); assert.equal(created.group.scheme, "notebook");
    await assert.rejects(f.load("db/account-appearance").saveAccountAppearance(identity(), { scheme: "minimal", mode: "dark" }, null), e => e.code === "APPEARANCE_UNAVAILABLE");
  } finally { f.close(); }
});

test("zero-group selection is server-owned, completes the tour and does not overwrite existing group preferences", async () => {
  const f = fixture();
  try {
    const before = f.sql.prepare("SELECT * FROM reading_group_memberships").all();
    await f.save(1, "editorial", "system");
    assert.deepEqual({ ...await f.initialAccountAppearance(1) }, { scheme: "editorial", mode: "system" });
    const state = await f.experience(1);
    assert.equal(state.appearanceAvailable, true); assert.deepEqual({ ...state.tour }, { version: 1, state: "completed" });
    assert.deepEqual({ ...state.appearance }, { scheme: "editorial", mode: "system" });
    assert.deepEqual(f.sql.prepare("SELECT * FROM reading_group_memberships").all(), before);
    assert.equal((await f.experience(2)).appearance, null);
  } finally { f.close(); }
});

test("all four schemes and three color modes persist without changing account roles", async () => {
  const f = fixture();
  try {
    for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark", "system"]) {
      await f.save(1, scheme, mode, "default");
      assert.deepEqual({ ...await f.readAccountAppearance(1) }, { scheme, mode });
      assert.deepEqual({ ...f.sql.prepare("SELECT scheme,color_mode AS mode FROM reading_group_memberships WHERE account_member_id=1 AND group_id='default'").get() }, { scheme, mode });
    }
    assert.equal(f.sql.prepare("SELECT role FROM members WHERE id=1").get().role, "super_admin");
    assert.equal((await f.experience(2)).appearance, null);
  } finally { f.close(); }
});

test("invalid schemes, modes and supplied victim IDs cannot save or complete the tour", async () => {
  const f = fixture();
  try {
    for (const body of [{ scheme: "unknown", mode: "dark" }, { scheme: "minimal", mode: "unknown" }, { scheme: "minimal", mode: "dark", memberId: 2 }]) {
      await assert.rejects(f.saveAccountAppearance(identity(), body, null), e => e.code === "INVALID_APPEARANCE");
    }
    assert.equal((await f.experience(1)).tour, null);
    assert.equal((await f.experience(1)).appearance, null);
  } finally { f.close(); }
});

test("revoked session or group membership cannot change either preference or tour", async () => {
  const f = fixture();
  try {
    await assert.rejects(f.saveAccountAppearance({ ...identity(), sessionVersion: 99 }, { scheme: "minimal", mode: "light" }, "default"), e => e.code === "APPEARANCE_CONFLICT");
    f.sql.exec("UPDATE reading_group_memberships SET is_active=0 WHERE account_member_id=1");
    await assert.rejects(f.save(1, "minimal", "light", "default"), e => e.code === "APPEARANCE_CONFLICT");
    assert.equal((await f.experience(1)).tour, null); assert.equal((await f.experience(1)).appearance, null);
  } finally { f.close(); }
});

test("transaction failure retains the existing preference and leaves tour uncompleted", async () => {
  const f = fixture();
  try {
    await f.save(1, "notebook", "system");
    f.sql.exec("DELETE FROM account_experience WHERE member_id=1");
    f.hooks.failBatch = true;
    await assert.rejects(f.save(1, "minimal", "dark", "default"));
    assert.deepEqual({ ...await f.readAccountAppearance(1) }, { scheme: "notebook", mode: "system" });
    assert.equal((await f.experience(1)).tour, null);
  } finally { f.close(); }
});

test("new shared groups and invitations inherit only the joining account's default, never overwrite existing memberships on retry", async () => {
  const f = fixture();
  try {
    await f.save(1, "editorial", "light"); await f.save(2, "minimal", "system");
    const requestKey = crypto.randomUUID(), created = await f.create(1, "Preference group", requestKey);
    assert.equal(created.group.scheme, "editorial"); assert.equal(created.group.mode, "light");
    const groups = f.load("db/onboarding-groups");
    const invite = await groups.manageInvitations(await f.request(1, created.group.id, "/invite", "POST"), "create");
    const joined = await groups.joinReadingGroup(2, invite.token);
    assert.equal(joined.group.scheme, "minimal"); assert.equal(joined.group.mode, "system");
    await f.save(1, "catalogue", "dark"); await f.save(2, "notebook", "dark");
    assert.equal((await f.create(1, "Preference group", requestKey)).group.scheme, "editorial");
    assert.equal((await groups.joinReadingGroup(2, invite.token)).group.scheme, "minimal");
  } finally { f.close(); }
});

test("appearance endpoint requires same origin, current account and a matching selected group", async () => {
  const f = fixture();
  try {
    const route = f.load("app/api/account/experience/route");
    const post = async (id, body, selected = "default", extra = {}) => route.POST(await f.request(id, selected, "/api/account/experience", "POST", { kind: "appearance", ...body }, extra));
    assert.equal((await post(1, { scheme: "minimal", mode: "dark" }, "default", { Origin: "https://evil.example" })).status, 403);
    assert.equal((await post(1, { scheme: "minimal", mode: "dark", groupId: "foreign" })).status, 409);
    assert.equal((await f.experience(1)).tour, null);
    const response = await post(1, { scheme: "minimal", mode: "dark", groupId: "default" });
    assert.equal(response.status, 200);
    const result = await response.json(); assert.equal(result.group.scheme, "minimal"); assert.equal(result.tour.state, "completed");
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal((await f.experience(2)).appearance, null);
  } finally { f.close(); }
});

test("account deletion cascades the new personal preference without touching another account", async () => {
  const f = fixture();
  try {
    await f.save(1); await f.save(2);
    f.sql.exec("DELETE FROM reading_group_memberships WHERE account_member_id=1; DELETE FROM account_profiles WHERE member_id=1; DELETE FROM account_experience WHERE member_id=1; DELETE FROM member_accounts WHERE member_id=1");
    assert.equal(await f.readAccountAppearance(1), null);
    assert.deepEqual({ ...await f.readAccountAppearance(2) }, { scheme: "minimal", mode: "light" });
    assert.deepEqual(f.sql.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { f.close(); }
});
