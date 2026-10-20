import assert from "node:assert/strict";
import test from "node:test";
import { spawnSync } from "node:child_process";
import { sharedGroupFixture } from "../fixtures/shared-groups-test.mjs";
import { describeSnapshot, verifySnapshot } from "../d1-backup-policy.mjs";
import { firebaseAccountFixture } from "../fixtures/firebase-account-test.mjs";
import { rehearseSharedGroupMigration, sharedGroupMigrationPlan } from "../shared-group-migration-policy.mjs";

test("0015 preserves all existing schema, typed records, account hashes, media and sequences", async () => {
  const f = firebaseAccountFixture();
  try {
    f.legacy();
    f.sql.exec("INSERT INTO books(title,author) VALUES('Existing','Author'); INSERT INTO media(media_key,content_type,data) VALUES('old-media','image/png',X'010203')");
    const before = describeSnapshot(f.sql);
    const rehearsal = await rehearseSharedGroupMigration(f.sql);
    assert.equal(rehearsal.status, "passed"); assert.equal(rehearsal.addedTables.length, 14);
    assert.deepEqual(sharedGroupMigrationPlan().files.map((file) => file.name), ["0015_shared_group_storage"]);
    await assert.rejects(rehearseSharedGroupMigration(f.sql), /ALREADY_PRESENT_OR_PARTIAL/);
    const schema = describeSnapshot(f.sql);
    await verifySnapshot({ ...before, schemaDigest: schema.schemaDigest }, async (sql) => f.sql.prepare(sql).all());
    for (const item of before.schema) assert.deepEqual(schema.schema.find((row) => row.name === item.name), item);
    assert.deepEqual(f.sql.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { f.close(); }
});

test("more than three groups across users need no new binding; retries are atomic and account limits are explicit", async () => {
  const f = sharedGroupFixture();
  try {
    const groups = [];
    for (let id = 1; id <= 4; id++) for (let n = 0; n < 2; n++) groups.push((await f.create(id, "Group " + id + n)).group);
    assert.equal(groups.length, 8); assert.equal(new Set(groups.map((g) => g.id)).size, 8);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM reading_groups").get().n, 9);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM shared_group_storage").get().n, 8);
    const key = crypto.randomUUID(); const a = await f.create(5, "Retry group", key), b = await f.create(5, "Retry group", key);
    assert.deepEqual(a, b);
    await assert.rejects(f.create(5, "Different name", key), (e) => e.code === "REQUEST_CONFLICT");
    await f.create(5, "Second"); await f.create(5, "Third");
    await assert.rejects(f.create(5, "Fourth"), (e) => e.code === "GROUP_CREATION_LIMIT");
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM shared_members WHERE group_id=?").get(a.group.id).n, 1);
    f.sql.exec("CREATE TRIGGER synthetic_shared_failure BEFORE INSERT ON shared_members BEGIN SELECT RAISE(ABORT,'synthetic atomic failure'); END");
    const before = f.sql.prepare("SELECT count(*) AS n FROM reading_groups").get().n;
    await assert.rejects(f.create(1, "Rollback"), /synthetic atomic failure/);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM reading_groups").get().n, before);
    assert.deepEqual(f.sql.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { f.close(); }
});

test("shared state, plans, books, meetings, reviews, votes, guests and trash keep complete tenant isolation", async () => {
  const f = sharedGroupFixture();
  try {
    const a = (await f.create(1, "Alpha")).group, b = (await f.create(2, "Beta")).group;
    for (const [account, group] of [[1, a], [2, b]]) {
      assert.equal((await f.action(account, group.id, { action: "createPlan", book: { title: group.name, author: "Author", pages: 500 } })).status, 200);
      const state = (await f.state(account, group.id)).body;
      assert.equal(state.roadmap.length, 1); assert.equal(state.books[0].title, group.name); assert.equal(state.members.length, 1);
      assert.equal((await f.action(account, group.id, { action: "voteBook", roadmapId: state.roadmap[0].id, active: true })).status, 200);
    }
    const as = (await f.state(1, a.id)).body, bs = (await f.state(2, b.id)).body;
    assert.equal((await f.action(1, a.id, { action: "voteBook", roadmapId: bs.roadmap[0].id, active: true })).status, 404);
    assert.equal((await f.action(1, a.id, { action: "createMeeting", bookId: bs.books[0].id, date: "2099-10-20T18:00", location: "Test" })).status, 404);
    const meeting = await f.action(1, a.id, { action: "createMeeting", planId: as.roadmap[0].id, date: "2099-10-20T18:00", location: "Test" });
    assert.equal(meeting.status, 200); assert.ok(meeting.body.meetingId);
    assert.equal((await f.action(1, a.id, { action: "review", meetingId: meeting.body.meetingId, readingStatus: "read", rating: 9, currentPage: 200 })).status, 200);
    assert.equal((await f.action(1, a.id, { action: "setMeetingRsvp", meetingId: meeting.body.meetingId, active: true })).status, 200);
    assert.equal((await f.action(1, a.id, { action: "toggleFavorite", bookId: as.books[0].id, active: true })).status, 200);
    assert.equal((await f.action(1, a.id, { action: "addGuest", meetingId: meeting.body.meetingId, guestName: "Guest" })).status, 200);
    assert.equal((await f.action(1, a.id, { action: "setVoteVisibility", voteVisibility: "secret" })).status, 200);
    assert.equal((await f.action(1, a.id, { action: "clearBookVotes" })).status, 200);
    const after = (await f.state(2, b.id)).body;
    assert.deepEqual(after.books, bs.books); assert.deepEqual(after.bookVotes, bs.bookVotes); assert.equal(after.voteVisibility, "open");
    assert.equal((await f.action(2, b.id, { action: "deleteMeeting", meetingId: meeting.body.meetingId })).status, 200);
    assert.equal((await f.state(1, a.id)).body.meetings.length, 1, "foreign mutation must not modify Alpha");
    await f.action(1, a.id, { action: "deleteMeeting", meetingId: meeting.body.meetingId });
    assert.equal((await f.state(1, a.id)).body.trash.length, 1);
    await f.action(1, a.id, { action: "restoreTrash", targetId: meeting.body.meetingId, trashType: "meeting" });
    await f.action(1, a.id, { action: "deleteMeeting", meetingId: meeting.body.meetingId });
    assert.equal((await f.action(1, a.id, { action: "purgeTrash", targetId: meeting.body.meetingId, trashType: "meeting" })).status, 200);
    assert.equal((await f.state(1, a.id)).body.meetings.length, 0);
    assert.deepEqual(f.sql.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { f.close(); }
});

test("shared invitation, scoped roles, four appearances, stale headers and revoked memberships retain their contracts", async () => {
  const f = sharedGroupFixture();
  try {
    const a = (await f.create(1, "Alpha")).group, b = (await f.create(2, "Beta")).group;
    const invites = f.load("db/onboarding-groups");
    const invite = await invites.manageInvitations(await f.request(1, a.id, "/api/onboarding/invitations", "POST"), "create");
    const joined = await invites.joinReadingGroup(2, invite.token); assert.equal(joined.group.role, "member");
    await invites.joinReadingGroup(2, invite.token);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM shared_group_account_links WHERE group_id=? AND account_member_id=2").get(a.id).n, 1);
    assert.equal((await f.action(2, a.id, { action: "clearBookVotes" })).status, 403);
    assert.equal((await f.action(2, b.id, { action: "clearBookVotes" })).status, 200);
    const route = f.load("app/api/groups/appearance/route");
    for (const scheme of ["editorial", "catalogue", "notebook", "minimal"]) for (const mode of ["light", "dark", "system"]) {
      const response = await route.PATCH(await f.request(2, a.id, "/api/groups/appearance", "PATCH", { scheme, mode }));
      assert.equal(response.status, 200); const json = await response.json(); assert.equal(json.group.scheme, scheme); assert.equal(json.group.mode, mode);
    }
    assert.equal(f.sql.prepare("SELECT scheme FROM reading_group_memberships WHERE account_member_id=2 AND group_id=?").get(b.id).scheme, "notebook");
    const state = f.load("app/api/state/route");
    assert.equal((await state.GET(await f.request(3, a.id))).status, 403);
    assert.equal((await state.GET(await f.request(2, a.id, "/api/state", "GET", undefined, { "X-Reading-Group": b.id }))).status, 409);
    const scoped = await f.load("lib/groups").resolveReadingGroup(await f.request(2, a.id));
    assert.throws(() => f.load("db/database").runWithReadingGroup(scoped.context, () => f.load("db/database").database()), /scoped domain/);
    f.sql.prepare("UPDATE reading_group_memberships SET is_active=0 WHERE account_member_id=2 AND group_id=?").run(a.id);
    assert.equal((await f.state(2, a.id)).status, 403);
    await assert.rejects(invites.joinReadingGroup(2, invite.token), (e) => e.code === "MEMBERSHIP_REVOKED");
  } finally { f.close(); }
});

test("composite foreign keys prevent cross-group writes even if an endpoint omits its existence check", async () => {
  const f = sharedGroupFixture();
  try {
    const a = (await f.create(1, "Alpha")).group, b = (await f.create(2, "Beta")).group;
    await f.action(2, b.id, { action: "createPlan", book: { title: "B", author: "Author" } });
    const bs = (await f.state(2, b.id)).body;
    await assert.rejects(f.domain(a.id).insert("roadmap", "book_id, created_by", "?, ?").bind(bs.books[0].id, (await f.state(1, a.id)).body.currentMemberId).run(), /FOREIGN KEY/);
    assert.throws(() => f.domain("unsafe' OR 1=1 --"), /INVALID_SHARED_GROUP/);
    assert.throws(() => f.domain(a.id).delete("member_accounts"), /INVALID_DOMAIN_TABLE/);
    assert.throws(() => f.domain(a.id).read("DELETE FROM books"), /DOMAIN_READ_REQUIRED/);
  } finally { f.close(); }
});

test("shared account erasure scopes every group checkpoint and media delete without touching unrelated tenants", async () => {
  const f = sharedGroupFixture();
  try {
    const a = (await f.create(1, "Alpha")).group, b = (await f.create(2, "Beta")).group;
    for (let id = 3; id <= 5; id++) for (let n = 0; n < 3; n++) await f.create(id, "Unrelated " + id + n);
    const onboarding = f.load("db/onboarding-groups");
    const inviteA = await onboarding.manageInvitations(await f.request(1, a.id, "/invite", "POST"), "create");
    const inviteB = await onboarding.manageInvitations(await f.request(2, b.id, "/invite", "POST"), "create");
    await onboarding.joinReadingGroup(2, inviteA.token); await onboarding.joinReadingGroup(1, inviteB.token);
    const ownerA = (await f.state(1, a.id)).body.currentMemberId;
    const successor = (await f.state(2, a.id)).body.currentMemberId;
    await f.domain(a.id).update("members", "role='admin'", "id=?").bind(successor).run();
    for (const [group, member] of [[a.id, ownerA], [b.id, (await f.state(2, b.id)).body.currentMemberId]]) {
      await f.domain(group).insert("media", "media_key,content_type,data", "?,'image/png',?").bind("same-key-different-tenant", new Uint8Array([1, 2, 3])).run();
      await f.domain(group).update("members", "avatar_media_key=?", "id=?").bind("same-key-different-tenant", member).run();
    }
    const requestId = crypto.randomUUID();
    f.sql.prepare("INSERT INTO account_deletion_requests(id,member_id,requested_at,updated_at) VALUES(?,1,1,1)").run(requestId);
    const service = f.load("db/account-erasure").accountErasureService(f.db, { DB: f.db }, undefined, { sharedGroups: true, incremental: true });
    const inspected = await service.inspect(requestId, { [a.id]: 2 });
    assert.equal(inspected.plan.steps.length, 3); assert.deepEqual(inspected.plan.blockers, []);
    let result;
    for (let n = 0; n < 5; n++) {
      result = await service.execute(requestId, { expectedDigest: inspected.digest, confirmation: inspected.plan.confirmation,
        writersStopped: true, contentReviewComplete: true, transfers: { [a.id]: 2 } });
      if (result.completed) break;
    }
    assert.equal(result.completed, true);
    assert.equal((await f.domain(a.id).read("SELECT count(*) AS n FROM media").first()).n, 0);
    assert.equal((await f.domain(b.id).read("SELECT count(*) AS n FROM media").first()).n, 1);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM member_accounts WHERE member_id=1").get().n, 0);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM shared_group_storage").get().n, 11);
    assert.equal((await f.domain(a.id).read("SELECT role FROM members WHERE id=?").bind(successor).first()).role, "super_admin");
    assert.deepEqual(f.sql.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { f.close(); }
});

test("creation can be paused without disabling shared group readers or switching back to legacy pools", async () => {
  const f = sharedGroupFixture();
  try {
    const a = (await f.create(1)).group;
    f.env.GROUP_CREATION_DISABLED = "true";
    await assert.rejects(f.create(2), (error) => error.code === "GROUP_CREATION_PAUSED");
    assert.equal((await f.state(1, a.id)).status, 200);
    f.env.SHARED_GROUPS_ENABLED = "false";
    await assert.rejects(f.load("lib/groups").accountReadingGroups(1), (error) => error.code === "GROUP_UNAVAILABLE");
  } finally { f.close(); }
});

test("a dedicated group created just before the switch retains its request retry and local member mapping", async () => {
  const f = sharedGroupFixture(), dedicated = firebaseAccountFixture();
  try {
    const key = crypto.randomUUID();
    f.env.READING_GROUP_DB_BINDINGS = '["GROUP_OLD"]'; f.env.GROUP_OLD = dedicated.db;
    f.sql.exec("INSERT INTO reading_groups(id,name,binding_name) VALUES('old','Old group','GROUP_OLD')");
    f.sql.prepare("INSERT INTO group_provisioning(group_id,owner_id,request_key,created_at) VALUES('old',1,?,1)").run(key);
    const result = await f.create(1, "Old group", key);
    assert.equal(result.group.id, "old"); assert.equal(result.group.role, "super_admin");
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM shared_group_storage").get().n, 0);
    assert.equal(dedicated.sql.prepare("SELECT count(*) AS n FROM members").get().n, 1);
    assert.equal((await f.state(1, "old")).status, 200);
  } finally { f.close(); dedicated.close(); }
});

test("shared production rollout rejects arbitrary targets and missing standard evidence before Cloudflare authentication", () => {
  for (const args of [[], ["--confirm=koru-shared-production", "--database=staging"],
    ["--confirm=koru-shared-production", "--suite=missing-suite.json", "--evidence=missing-evidence.json"],
    ["--confirm=koru-shared-production", "--suite=missing-suite.json", "--evidence=missing-evidence.json", "--decision=old-first-launch.json"]]) {
    const result = spawnSync(process.execPath, ["scripts/deploy-shared-groups.mjs", ...args], { encoding: "utf8", timeout: 30_000 });
    assert.notEqual(result.status, 0);
    assert.doesNotMatch(result.stdout + result.stderr, /Successfully logged in|Uploaded|Created database|Shared group rollout:/);
    if (args.length === 3) assert.match(result.stderr, /COMMAND_FAILED:scripts\/check-web-release/);
  }
});
