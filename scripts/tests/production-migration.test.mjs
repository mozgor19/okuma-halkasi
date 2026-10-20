import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { LEGACY_GROUP_NAME } from "../../lib/branding.ts";
import { describeSnapshot, openSnapshot } from "../d1-backup-policy.mjs";
import { legacyMigrations, productionMigrationPlan, rehearseProductionMigration } from "../production-migration-policy.mjs";

function fixture() {
  const sql = legacyMigrations.map((name) => readFileSync(new URL(`../../drizzle/${name}.sql`, import.meta.url), "utf8")).join("\n");
  const db = openSnapshot(sql);
  db.exec(`INSERT INTO members(id,name,role,is_guest) VALUES(1,'Synthetic Owner','super_admin',0),(7,'Synthetic Reader','member',0),(8,'Synthetic Guest','member',1),(10,'Bootstrap Only','admin',0);
    INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations,session_version)
      VALUES(1,'synthetic.owner','${"a".repeat(64)}','${"b".repeat(32)}',100000,5),(7,'synthetic.reader','${"c".repeat(64)}','${"d".repeat(32)}',100000,2);
    INSERT INTO books(id,title,author) VALUES(11,'Synthetic Book','Synthetic Author');
    INSERT INTO meetings(id,book_id,date,location,created_by) VALUES(20,11,'2026-10-19','Synthetic Place',1);
    INSERT INTO attendance(meeting_id,member_id) VALUES(20,1),(20,7),(20,8);
    INSERT INTO meeting_rsvps(meeting_id,member_id) VALUES(20,7);
    INSERT INTO reviews(meeting_id,member_id,rating,comment) VALUES(20,7,5,'Synthetic Review');
    INSERT INTO media(media_key,content_type,data) VALUES('synthetic-photo','image/png',X'000102FF');
    INSERT INTO photos(meeting_id,media_key,uploaded_by) VALUES(20,'synthetic-photo',1);
    INSERT INTO roadmap(id,book_id,created_by) VALUES(30,11,1);
    INSERT INTO book_votes(member_id,roadmap_id) VALUES(7,30);
    INSERT INTO favorite_books(member_id,book_id) VALUES(7,11);
    INSERT INTO members(id,name) VALUES(99,'Removed Member'); DELETE FROM members WHERE id=99;`);
  return db;
}
test("production migration plan is deterministic and scopes new account tables to the canonical DB", () => {
  const first = productionMigrationPlan();
  assert.deepEqual(productionMigrationPlan(), first);
  assert.deepEqual(first.files.map((item) => item.name.slice(0, 4)), ["0008", "0009", "0010", "0011", "0012", "0013", "0014"]);
  assert.equal(first.seed[0].params[0], LEGACY_GROUP_NAME);
  assert.doesNotMatch(first.files.map((item) => item.sql).join("\n"), /DROP TABLE|DELETE FROM|ALTER TABLE.*member_accounts/i);
});
test("offline migration preserves all legacy bytes, hashes, roles, IDs, session versions and sequences", async () => {
  const db = fixture();
  try {
    const before = describeSnapshot(db);
    const result = await rehearseProductionMigration(db);
    assert.equal(result.status, "passed");
    assert.equal(result.preserved.length, 13);
    assert.equal(result.addedTables.length, 21);
    assert.equal(result.defaultMemberships, 3);
    assert.deepEqual(result.legacyAccounts, { total: 2, knownLegacyHashFormat: 2, verifiedEmailProfiles: 0, automaticFirebaseImports: 0 });
    const after = describeSnapshot(db);
    for (const old of before.tables) assert.deepEqual(after.tables.find((item) => item.name === old.name), old);
    assert.deepEqual(after.sequence, before.sequence);
    assert.deepEqual(db.prepare("SELECT id FROM members WHERE role='super_admin'").all().map((row) => row.id), [1]);
    assert.equal(db.prepare("SELECT session_version FROM member_accounts WHERE member_id=1").get().session_version, 5);
    assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1);
  } finally { db.close(); }
});
test("existing non-guest members retain the default group, guests are excluded, and emails are never guessed", async () => {
  const db = fixture();
  try {
    await rehearseProductionMigration(db);
    assert.deepEqual(db.prepare("SELECT account_member_id,member_id FROM reading_group_memberships ORDER BY account_member_id").all().map((row) => ({ ...row })),
      [{ account_member_id: 1, member_id: 1 }, { account_member_id: 7, member_id: 7 }, { account_member_id: 10, member_id: 10 }]);
    assert.equal(db.prepare("SELECT name FROM reading_groups WHERE id='default'").get().name, LEGACY_GROUP_NAME);
    assert.equal(db.prepare("SELECT count(*) AS n FROM account_profiles").get().n, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM group_invitations").get().n, 0);
    assert.deepEqual(db.prepare("SELECT singleton,project_id FROM firebase_environment").all().map((row) => ({ ...row })), [{ singleton: 1, project_id: "koru-951bf" }]);
    for (const table of ["firebase_registrations", "firebase_links", "firebase_sessions"]) assert.equal(db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
  } finally { db.close(); }
});
test("partially applied, already migrated or unknown source schemas are refused without mutation", async () => {
  for (const change of ["CREATE TABLE unknown_test(value TEXT)", "ALTER TABLE members ADD extra TEXT", productionMigrationPlan().files[0].sql]) {
    const db = fixture();
    try {
      db.exec(change);
      const before = describeSnapshot(db);
      await assert.rejects(rehearseProductionMigration(db), /MIGRATION_UNREVIEWED_SOURCE_SCHEMA/);
      assert.deepEqual(describeSnapshot(db), before);
    } finally { db.close(); }
  }
  const db = fixture();
  try {
    await rehearseProductionMigration(db);
    const before = describeSnapshot(db);
    await assert.rejects(rehearseProductionMigration(db), /MIGRATION_UNREVIEWED_SOURCE_SCHEMA/);
    assert.deepEqual(describeSnapshot(db), before);
  } finally { db.close(); }
});
test("dangling references or guest/invalid-role accounts block migration before new tables are created", async () => {
  for (const change of ["UPDATE member_accounts SET member_id=999 WHERE member_id=7", "UPDATE members SET is_guest=1 WHERE id=7", "UPDATE members SET role='unknown' WHERE id=1"]) {
    const db = fixture();
    try {
      db.exec(change);
      const before = describeSnapshot(db);
      await assert.rejects(rehearseProductionMigration(db), /MIGRATION_FOREIGN_KEYS|MIGRATION_ACCOUNT_REVIEW_REQUIRED/);
      assert.deepEqual(describeSnapshot(db), before);
    } finally { db.close(); }
  }
});
function intercepted(db, intercept, after = () => {}) {
  return new Proxy(db, { get(target, key) {
    if (key === "exec") return (sql) => { intercept(sql); const result = target.exec(sql); after(sql); return result; };
    const value = Reflect.get(target, key, target);
    return typeof value === "function" ? value.bind(target) : value;
  } });
}
test("interrupted migration rolls back ALL new tables and seeds, leaving the original schema/data intact", async () => {
  const db = fixture();
  try {
    const before = describeSnapshot(db);
    const fault = intercepted(db, (sql) => { if (sql.includes("CREATE TABLE account_experience")) throw Error("Synthetic interruption"); });
    await assert.rejects(rehearseProductionMigration(fault), /transaction rolled back/);
    assert.deepEqual(describeSnapshot(db), before);
    assert.equal((await rehearseProductionMigration(db)).status, "passed");
  } finally { db.close(); }
});
test("unexpected legacy data changes with unchanged row counts fail verification and roll back", async () => {
  const db = fixture();
  try {
    const before = describeSnapshot(db);
    const fault = intercepted(db, (sql) => { if (sql.includes("CREATE TABLE account_experience")) db.exec("UPDATE media SET data=X'ABCDEF'"); });
    await assert.rejects(rehearseProductionMigration(fault), /transaction rolled back/);
    assert.deepEqual(describeSnapshot(db), before);
  } finally { db.close(); }
});
test("missing project marker or unexpected Firebase identity data fails rehearsal and rolls back", async () => {
  for (const change of [
    "DELETE FROM firebase_environment",
    "INSERT INTO firebase_registrations(id,project_id,email,username,name,expires_at) VALUES('synthetic','koru-951bf','synthetic@example.test','synthetic','Synthetic',1)",
  ]) {
    const db = fixture();
    try {
      const before = describeSnapshot(db);
      const fault = intercepted(db, () => {}, (sql) => {
        if (sql.includes("CREATE INDEX firebase_sessions_member")) db.exec(change);
      });
      await assert.rejects(rehearseProductionMigration(fault), /transaction rolled back/);
      assert.deepEqual(describeSnapshot(db), before);
    } finally { db.close(); }
  }
});
test("aggregate report never contains personal rows, username, private comments, hashes or SQL", async () => {
  const db = fixture();
  try {
    const report = JSON.stringify(await rehearseProductionMigration(db));
    assert.doesNotMatch(report, /Synthetic Owner|synthetic\.owner|Synthetic Review|password_hash|CREATE TABLE|aaaaaaaaaaaaaaaa/);
  } finally { db.close(); }
});
test("offline CLI rejects missing/path-traversal/remote-target options without network or private diagnostics", () => {
  for (const args of [[], ["--backup-id=../../private"], ["--apply"], ["--backup-id=7903973b-2169-42cf-9401-414b53a17ec0", "--remote"]]) {
    const result = spawnSync(process.execPath, [new URL("../rehearse-production-migration.mjs", import.meta.url).pathname, ...args], { encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /No remote requests or live SQL writes/);
    assert.doesNotMatch(result.stderr, /AssertionError|password_hash|BEGIN PRIVATE KEY/);
  }
});
