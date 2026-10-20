import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { assertBackupSourceBindings, assertDrillTarget, assertFreeCapacity, catalogSql, describeSnapshot, digest, openSnapshot,
  openSql, restoreSql, sealSql, verifySnapshot } from "../d1-backup-policy.mjs";
import { production } from "../web-production-policy.mjs";

const runId = "11111111-1111-4111-8111-111111111111";
const targetId = "22222222-2222-4222-8222-222222222222";
test("backup supports the original source and current three-binding topology without accepting aliases or foreign targets", () => {
  const canonical = { type: "d1", name: "DB", database_id: production.canonicalDatabaseId };
  const first = { type: "d1", name: "GROUP_CREATE_ONE", database_id: targetId };
  const second = { type: "d1", name: "GROUP_CREATE_TWO", database_id: "33333333-3333-4333-8333-333333333333" };
  assert.doesNotThrow(() => assertBackupSourceBindings([canonical]));
  assert.doesNotThrow(() => assertBackupSourceBindings([second, { type: "plain_text", name: "SHARED_GROUPS_ENABLED", text: "true" }, canonical, first]));
  for (const bindings of [[], [first], [canonical, first], [canonical, first, second, { ...second, name: "EXTRA" }],
    [{ ...canonical, database_id: targetId }], [canonical, first, { ...second, name: "STAGING" }],
    [canonical, first, { ...second, database_id: targetId }], [canonical, first, { ...second, database_id: production.canonicalDatabaseId }],
    [canonical, first, { ...second, database_id: "invalid" }], [canonical, first, { ...second, name: "GROUP_CREATE_ONE" }]]) {
    assert.throws(() => assertBackupSourceBindings(bindings));
  }
});
test("remote entry point refuses missing approval and arbitrary existing target arguments before authentication", () => {
  const script = new URL("../backup-production-d1.mjs", import.meta.url);
  for (const args of [[], ["--confirm=wrong"], ["--confirm=production-backup-and-isolated-restore", "--target=" + production.canonicalDatabaseId]]) {
    const result = spawnSync(process.execPath, [script.pathname, ...args], { encoding: "utf8", timeout: 10000 });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /stopped before execution; private diagnostics withheld/);
    assert.equal(result.stdout, "");
  }
});
const largeBlob = Buffer.from(Array.from({ length: 160000 }, (_, index) => index % 256));
const text = "O'Reilly; DROP TABLE members; --\nTurkce: \u00d6\u011f\u0131\0" + "large text ".repeat(5000);
function fixture() {
  return openSnapshot(`
    PRAGMA foreign_keys=OFF;
    CREATE TABLE members(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,meeting_id INTEGER REFERENCES meetings(id));
    CREATE TABLE meetings(id INTEGER PRIMARY KEY AUTOINCREMENT,owner INTEGER NOT NULL REFERENCES members(id));
    CREATE TABLE media(media_key TEXT PRIMARY KEY, data BLOB NOT NULL, note TEXT, large_integer INTEGER, real_number REAL, nullable TEXT);
    INSERT INTO members VALUES(1,'Synthetic member',1);
    INSERT INTO meetings VALUES(1,1);
    INSERT INTO members VALUES(50,'Deleted synthetic row',NULL);
    DELETE FROM members WHERE id=50;
    INSERT INTO media VALUES('synthetic',X'${largeBlob.toString("hex")}',CAST(X'${Buffer.from(text).toString("hex")}' AS TEXT),9223372036854775807,1.23456789012345,NULL);
    CREATE INDEX media_note_index ON media(note);
    CREATE VIEW member_names AS SELECT name FROM members;
    CREATE TRIGGER media_update AFTER UPDATE ON media BEGIN UPDATE members SET name='Updated synthetic member' WHERE id=1; END;
  `);
}
test("encrypted backup round trips from authenticated ciphertext and rejects wrong key or changed metadata", () => {
  const key = randomBytes(32), metadata = { runId, source: production.canonicalDatabaseId };
  const envelope = sealSql("Synthetic private SQL\0", key, metadata);
  assert.ok(!envelope.includes("Synthetic private SQL"));
  assert.equal(openSql(envelope, key, metadata), "Synthetic private SQL\0");
  assert.throws(() => openSql(envelope, randomBytes(32), metadata));
  assert.throws(() => openSql(envelope, key, { ...metadata, source: targetId }));
  const changed = JSON.parse(envelope);
  const bytes = Buffer.from(changed.data, "base64"); bytes[0] ^= 1; changed.data = bytes.toString("base64");
  assert.throws(() => openSql(JSON.stringify(changed), key, metadata));
});
test("a restore target cannot be production, a preexisting/staging database, wrongly named or Worker-bound", () => {
  const name = "koru-restore-drill-" + runId;
  const target = { uuid: targetId, name };
  const scope = { runId, name, existingIds: [production.canonicalDatabaseId], bindings: [] };
  assert.doesNotThrow(() => assertDrillTarget(target, scope));
  assert.throws(() => assertDrillTarget({ ...target, uuid: production.canonicalDatabaseId }, scope));
  assert.throws(() => assertDrillTarget(target, { ...scope, existingIds: [targetId] }));
  assert.throws(() => assertDrillTarget({ ...target, name: "koru-staging-main" }, scope));
  assert.throws(() => assertDrillTarget(target, { ...scope, bindings: [{ type: "d1", database_id: targetId }] }));
});
test("Free quota preflight rejects full inventory, unknown sizes, unexpected source and oversized storage", () => {
  const source = { uuid: production.canonicalDatabaseId, file_size: 1024 };
  assert.equal(assertFreeCapacity([source], source.uuid), source);
  assert.throws(() => assertFreeCapacity(Array.from({ length: 10 }, (_, i) => ({ uuid: String(i), file_size: 1024 })), source.uuid));
  assert.throws(() => assertFreeCapacity([{ uuid: source.uuid }], source.uuid));
  assert.throws(() => assertFreeCapacity([{ ...source, uuid: targetId }], targetId));
  assert.throws(() => assertFreeCapacity([source, { uuid: targetId, file_size: 5 * 1024 ** 3 }], source.uuid));
});
test("SQLite parser rejects malformed, externally attached or virtual-table snapshots without echoing private SQL", () => {
  for (const sql of ["secret invalid SQL", "ATTACH ':memory:' AS another", "CREATE VIRTUAL TABLE fts USING fts5(secret)"])
    assert.throws(() => openSnapshot(sql), (error) => error.message === "BACKUP_SNAPSHOT_INVALID; SQL and private values withheld");
});
test("native dump order can precede parents while actual dangling foreign keys still block restore", () => {
  const schema = "CREATE TABLE child(id INTEGER PRIMARY KEY,parent_id INTEGER REFERENCES parent(id)); CREATE TABLE parent(id INTEGER PRIMARY KEY);";
  const valid = openSnapshot(schema + "INSERT INTO child VALUES(1,2); INSERT INTO parent VALUES(2);");
  valid.close();
  assert.throws(() => openSnapshot(schema + "INSERT INTO child VALUES(1,2);"), /BACKUP_SNAPSHOT_INVALID/);
});
test("portable restore preserves large BLOBs, Unicode/NUL text, int64, real/null, cycles, indexes, views, triggers and sequence high-water", async () => {
  const original = fixture();
  let restored;
  try {
    const snapshot = describeSnapshot(original);
    const plan = restoreSql(snapshot);
    assert.ok(plan.statementCount > 10);
    assert.equal(plan.statements.length, plan.statementCount);
    assert.ok(plan.statements.every((sql) => Buffer.byteLength(sql) < 90000));
    restored = openSnapshot("PRAGMA foreign_keys=ON;BEGIN;" + plan.sql + "COMMIT;");
    assert.deepEqual(Buffer.from(restored.prepare("SELECT data FROM media").get().data), largeBlob);
    assert.equal(restored.prepare("SELECT hex(CAST(note AS BLOB)) AS bytes FROM media").get().bytes, Buffer.from(text).toString("hex").toUpperCase());
    assert.equal(restored.prepare("SELECT CAST(large_integer AS TEXT) AS value FROM media").get().value, "9223372036854775807");
    const tables = await verifySnapshot(snapshot, async (sql) => restored.prepare(sql).all());
    assert.equal(tables.length, 3);
    assert.equal(restored.prepare("SELECT seq FROM sqlite_sequence WHERE name='members'").get().seq, 50);
    assert.equal(restored.prepare("SELECT count(*) AS n FROM sqlite_schema WHERE type='trigger'").get().n, 1);
    assert.equal(restored.prepare("SELECT name FROM members").get().name, "Synthetic member", "Import must not fire restored triggers");
    assert.equal(digest(JSON.stringify(restored.prepare(catalogSql).all())), snapshot.schemaDigest);
  } finally { original.close(); restored?.close(); }
});
test("integrity verification catches corrupted media, schema and same-count account changes", async () => {
  const original = fixture();
  try {
    const snapshot = describeSnapshot(original);
    const plan = restoreSql(snapshot);
    for (const mutation of ["UPDATE media SET data=X'010203'", "DROP INDEX media_note_index", "UPDATE members SET name='Wrong synthetic identity'"]) {
      const target = openSnapshot("PRAGMA foreign_keys=ON;BEGIN;" + plan.sql + "COMMIT;");
      try { target.exec(mutation); await assert.rejects(verifySnapshot(snapshot, async (sql) => target.prepare(sql).all()), /mismatch/); }
      finally { target.close(); }
    }
  } finally { original.close(); }
});
