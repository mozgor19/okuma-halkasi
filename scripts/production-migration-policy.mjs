import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LEGACY_GROUP_NAME } from "../lib/branding.ts";
import { catalogSql, describeSnapshot, digest, openSnapshot, verifySnapshot } from "./d1-backup-policy.mjs";

export const legacyMigrations = Object.freeze([
  "0000_strange_eternals", "0001_store_media_in_d1", "0002_member_accounts",
  "0003_member_profiles_and_reading_progress", "0004_face_recognition",
  "0005_club_tools", "0006_super_admin_roles", "0007_meeting_rsvps",
]);
export const canonicalMigrations = Object.freeze([
  "0008_reading_groups", "0009_self_service", "0010_group_account_links",
  "0011_account_experience", "0012_account_erasure_jobs", "0013_firebase_auth",
]);
const migration = (name) => readFileSync(new URL(`../drizzle/${name}.sql`, import.meta.url), "utf8");

export function productionMigrationPlan() {
  const files = canonicalMigrations.map((name) => ({ name, sql: migration(name) }));
  const seed = [
    { sql: "UPDATE reading_groups SET name=? WHERE id='default' AND binding_name='DB'", params: [LEGACY_GROUP_NAME] },
    { sql: "INSERT INTO group_database_ownership(singleton,group_id) VALUES(1,'default')", params: [] },
    { sql: "INSERT INTO group_account_links(account_member_id,member_id) SELECT id,id FROM members WHERE is_guest=0", params: [] },
  ];
  return { files, seed, digest: digest(JSON.stringify({ files, seed })) };
}

function legacyReference() { return openSnapshot(legacyMigrations.map(migration).join("\n")); }
function assertIntegrity(db) {
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), [], "MIGRATION_FOREIGN_KEYS");
  assert.equal(db.prepare("PRAGMA quick_check").get().quick_check, "ok", "MIGRATION_INTEGRITY");
}
function assertDefaultGroup(db, memberIds) {
  assert.deepEqual(db.prepare("SELECT id,name,binding_name FROM reading_groups").all().map((row) => ({ ...row })),
    [{ id: "default", name: LEGACY_GROUP_NAME, binding_name: "DB" }], "MIGRATION_DEFAULT_GROUP");
  const memberships = db.prepare("SELECT account_member_id,group_id,member_id,is_active,scheme,color_mode FROM reading_group_memberships ORDER BY account_member_id").all().map((row) => ({ ...row }));
  assert.deepEqual(memberships, memberIds.map((id) => ({ account_member_id: id, group_id: "default", member_id: id, is_active: 1, scheme: "notebook", color_mode: "system" })), "MIGRATION_MEMBERSHIP_MAPPING");
  assert.deepEqual(db.prepare("SELECT account_member_id,member_id FROM group_account_links ORDER BY account_member_id").all().map((row) => ({ ...row })),
    memberIds.map((id) => ({ account_member_id: id, member_id: id })), "MIGRATION_DOMAIN_MAPPING");
  assert.deepEqual(db.prepare("SELECT singleton,group_id FROM group_database_ownership").all().map((row) => ({ ...row })),
    [{ singleton: 1, group_id: "default" }], "MIGRATION_DOMAIN_OWNERSHIP");
}

// Offline rehearsal only. No Cloudflare authentication, network or live writer.
export async function rehearseProductionMigration(db) {
  const reference = legacyReference();
  let referenceSnapshot;
  try { referenceSnapshot = describeSnapshot(reference); } finally { reference.close(); }
  const before = describeSnapshot(db);
  assert.equal(before.schemaDigest, referenceSnapshot.schemaDigest, "MIGRATION_UNREVIEWED_SOURCE_SCHEMA");
  assertIntegrity(db);
  const members = db.prepare("SELECT id FROM members WHERE is_guest=0 ORDER BY id").all().map((row) => row.id);
  const invalidAccounts = db.prepare("SELECT count(*) AS n FROM member_accounts a JOIN members m ON m.id=a.member_id WHERE m.is_guest<>0 OR m.role NOT IN ('member','admin','super_admin')").get().n;
  assert.equal(invalidAccounts, 0, "MIGRATION_ACCOUNT_REVIEW_REQUIRED");
  const plan = productionMigrationPlan();
  const expected = legacyReference();
  let expectedSchemaDigest;
  try {
    for (const file of plan.files) expected.exec(file.sql);
    expectedSchemaDigest = describeSnapshot(expected).schemaDigest;
  } finally { expected.close(); }

  db.exec("PRAGMA foreign_keys=ON");
  assert.equal(db.prepare("PRAGMA foreign_keys").get().foreign_keys, 1, "MIGRATION_FOREIGN_KEYS_DISABLED");
  db.exec("SAVEPOINT koru_migration_rehearsal");
  try {
    for (const file of plan.files) db.exec(file.sql);
    for (const seed of plan.seed) db.prepare(seed.sql).run(...seed.params);
    assert.equal(describeSnapshot(db).schemaDigest, expectedSchemaDigest, "MIGRATION_TARGET_SCHEMA");
    assertDefaultGroup(db, members);
    assert.deepEqual(db.prepare("SELECT singleton,project_id FROM firebase_environment").all().map((row) => ({ ...row })),
      [{ singleton: 1, project_id: "koru-951bf" }], "MIGRATION_FIREBASE_PROJECT_MARKER");
    // Original schema objects/rows/sequences must remain byte-for-byte identical.
    const originalNames = new Set(before.schema.map((item) => item.name));
    const originalSchema = db.prepare(catalogSql).all().filter((item) => originalNames.has(item.name));
    assert.equal(digest(JSON.stringify(originalSchema)), before.schemaDigest, "MIGRATION_LEGACY_SCHEMA_CHANGED");
    const preserved = await verifySnapshot({ ...before, schemaDigest: expectedSchemaDigest }, async (sql) => db.prepare(sql).all());
    const newTables = describeSnapshot(db).tables.filter((table) => !before.tables.some((old) => old.name === table.name));
    for (const table of newTables) if (!["reading_groups", "reading_group_memberships", "group_account_links", "group_database_ownership", "firebase_environment"].includes(table.name))
      assert.equal(table.count, 0, "MIGRATION_UNEXPECTED_SEED_DATA");
    assertIntegrity(db);
    const accounts = db.prepare(`SELECT count(*) AS total,
      coalesce(sum(CASE WHEN password_iterations=100000 AND length(password_hash)=64 AND password_hash NOT GLOB '*[^0-9a-f]*'
        AND length(password_salt)=32 AND password_salt NOT GLOB '*[^0-9a-f]*' THEN 1 ELSE 0 END),0) AS knownLegacyHashFormat
      FROM member_accounts`).get();
    db.exec("RELEASE koru_migration_rehearsal");
    return { status: "passed", migrationDigest: plan.digest, migrations: plan.files.map((file) => ({ name: file.name, digest: digest(file.sql) })),
      preserved, addedTables: newTables.map((table) => table.name), defaultMemberships: members.length,
      legacyAccounts: { ...accounts, verifiedEmailProfiles: 0, automaticFirebaseImports: 0 },
      limitations: "Offline SQLite rehearsal only, not remote D1 SQL, provider migration, concurrency, application or release acceptance. Legacy accounts have no verified email profiles; reviewed claim/recovery is required before provider linking." };
  } catch {
    db.exec("ROLLBACK TO koru_migration_rehearsal");
    db.exec("RELEASE koru_migration_rehearsal");
    throw Error("MIGRATION_REHEARSAL_FAILED; transaction rolled back, private details withheld");
  }
}
