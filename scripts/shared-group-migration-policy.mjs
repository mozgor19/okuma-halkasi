import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describeSnapshot, digest, verifySnapshot } from "./d1-backup-policy.mjs";
import { migrationBatch } from "./production-deploy-policy.mjs";

// Separate from the already-consumed first-launch 0008-0014 migration plan.
export function sharedGroupMigrationPlan() {
  const name = "0015_shared_group_storage";
  const sql = readFileSync(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");
  const files = [{ name, sql }];
  return { files, digest: digest(sql), ...migrationBatch(files) };
}

export async function rehearseSharedGroupMigration(db) {
  const before = describeSnapshot(db), plan = sharedGroupMigrationPlan();
  assert.ok(before.tables.some((t) => t.name === "reading_groups") && before.tables.some((t) => t.name === "account_erasure_provider_checkpoints"), "SHARED_STORAGE_REQUIRES_CURRENT_CANONICAL_SCHEMA");
  assert.ok(!before.tables.some((t) => t.name.startsWith("shared_")), "SHARED_STORAGE_ALREADY_PRESENT_OR_PARTIAL");
  assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1, "SHARED_STORAGE_FOREIGN_KEYS_REQUIRED");
  db.exec("SAVEPOINT koru_shared_storage");
  try {
    for (const statement of plan.batch) db.prepare(statement.sql).run(...statement.params);
    const after = describeSnapshot(db);
    for (const item of before.schema) assert.deepEqual(after.schema.find((row) => row.name === item.name), item, "SHARED_STORAGE_CHANGED_EXISTING_SCHEMA");
    const preserved = await verifySnapshot({ ...before, schemaDigest: after.schemaDigest }, async (sql) => db.prepare(sql).all());
    const added = after.tables.filter((table) => !before.tables.some((old) => old.name === table.name));
    assert.equal(added.length, 14); assert.ok(added.every((table) => table.count === 0));
    assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
    assert.equal(db.prepare("PRAGMA quick_check").get().quick_check, "ok");
    db.exec("RELEASE koru_shared_storage");
    return { status: "passed", migrationDigest: plan.digest, preserved, addedTables: added.map((t) => t.name),
      targetSchemaDigest: after.schemaDigest, scope: "offline-rehearsal-only-no-production-write" };
  } catch (error) {
    db.exec("ROLLBACK TO koru_shared_storage"); db.exec("RELEASE koru_shared_storage"); throw error;
  }
}
