import assert from "node:assert/strict";
import { constants } from "node:fs";
import fs from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { openSnapshot, openSql } from "./d1-backup-policy.mjs";
import { production } from "./web-production-policy.mjs";
import { rehearseProductionMigration } from "./production-migration-policy.mjs";
import { sourceIdentity } from "./release-source.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = join(root, ".sites-runtime/koru-production");
async function privateRead(path) {
  const file = await fs.open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    assert.ok(info.isFile() && info.uid === process.getuid() && (info.mode & 0o077) === 0 && info.size <= 30 * 1024 * 1024);
    return await file.readFile();
  } finally { await file.close(); }
}
async function privateDirectory(path) {
  const stat = await fs.lstat(path);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o077) === 0);
}

async function run() {
  const args = process.argv.slice(2);
  assert.equal(args.length, 1);
  assert.match(args[0], /^--backup-id=[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
  const backupId = args[0].slice("--backup-id=".length);
  for (const path of [join(root, ".sites-runtime"), base, join(base, "backups"), join(base, "backups", backupId), join(base, "backup-keys")]) await privateDirectory(path);
  const envelope = (await privateRead(join(base, "backups", backupId, "snapshot.aes256gcm.json"))).toString("utf8");
  const metadata = JSON.parse(envelope).metadata;
  assert.equal(metadata.runId, backupId);
  assert.equal(metadata.sourceDatabaseId, production.canonicalDatabaseId);
  assert.ok(Number.isFinite(Date.parse(metadata.exportedAt)));
  const key = await privateRead(join(base, "backup-keys", backupId + ".key"));
  const db = openSnapshot(openSql(envelope, key, metadata));
  key.fill(0);
  let result;
  try { result = await rehearseProductionMigration(db); } finally { db.close(); }
  const folder = join(base, "migration-rehearsals");
  await fs.mkdir(folder, { recursive: true, mode: 0o700 });
  await privateDirectory(folder);
  const reportPath = join(folder, randomUUID() + ".json");
  const report = { ...result, checkedAt: new Date().toISOString(), ...sourceIdentity(), backupId, exportedAt: metadata.exportedAt,
    sourceDatabaseId: production.canonicalDatabaseId, remoteRequests: 0, liveSqlWrites: 0, stagingCopied: false };
  const file = await fs.open(reportPath, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await file.writeFile(JSON.stringify(report, null, 2)); await file.sync(); } finally { await file.close(); }
  console.log(JSON.stringify({ status: report.status, preservedTables: result.preserved.length,
    addedTables: result.addedTables.length, legacyAccounts: result.legacyAccounts, remoteRequests: 0, liveSqlWrites: 0,
    report: reportPath.slice(root.length) }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await run().catch(() => {
  console.error("Offline migration rehearsal stopped; private details withheld. No remote requests or live SQL writes.");
  process.exitCode = 1;
});
