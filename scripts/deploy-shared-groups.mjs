import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { constants, closeSync, existsSync, lstatSync, mkdirSync, openSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { randomUUID } from "node:crypto";
import { sourceIdentity } from "./release-source.mjs";
import { production, productionBindingFailures } from "./web-production-policy.mjs";
import { productionDeploymentConfig, productionPools } from "./production-deploy-policy.mjs";
import { describeSnapshot, openSnapshot, openSql, verifySnapshot } from "./d1-backup-policy.mjs";
import { rehearseSharedGroupMigration, sharedGroupMigrationPlan } from "./shared-group-migration-policy.mjs";
import { sharedUpdateAssessment } from "./shared-update-policy.mjs";
import { sharedUpdateSourceScope } from "./shared-update-source.mjs";

const args = process.argv.slice(2);
assert.ok(args.includes("--confirm=koru-shared-production") && [3, 4].includes(args.length)
  && args.filter((arg) => arg.startsWith("--suite=")).length === 1
  && args.filter((arg) => arg.startsWith("--evidence=")).length === 1
  && (args.length === 3 || args.filter((arg) => arg.startsWith("--decision=")).length === 1),
"Use --confirm=koru-shared-production --suite=path --evidence=path and optional revision-bound --decision=path; no arbitrary target");
const option = (key) => args.find((arg) => arg.startsWith(key + "="))?.slice(key.length + 1);
function run(file, args = []) {
  const result = spawnSync(process.execPath, [file, ...args], { encoding: "utf8", timeout: 300_000, maxBuffer: 8 * 1024 * 1024,
    env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", CI: "1" } });
  if (result.status !== 0) throw Error("SHARED_ROLLOUT_COMMAND_FAILED:" + file + "; sensitive output withheld");
  return result.stdout;
}
// Gate before authentication/writes. An explicitly approved shared-update risk
// decision is evaluated separately, never turned into passing manual evidence.
let assessment = { mode: "standard", standardGatePassed: true, pendingChecks: [] };
if (option("--decision")) {
  const read = (path) => JSON.parse(readFileSync(path, "utf8"));
  assessment = sharedUpdateAssessment({ suite: read(option("--suite")), audit: read("outputs/web-security/dependency-audit.json"),
    evidence: read(option("--evidence")), current: sourceIdentity(), proofExists(path) {
      try { const stat = lstatSync(path); return stat.isFile() && stat.size > 0 && realpathSync(path).startsWith(resolve("outputs/web-acceptance") + sep); }
      catch { return false; }
    } }, read(option("--decision")), sharedUpdateSourceScope());
  assert.deepEqual(assessment.failures, [], "Shared update technical gate, source scope or explicit operator decision incomplete");
} else run("scripts/check-web-release.mjs", ["--suite=" + option("--suite"), "--evidence=" + option("--evidence")]);
const revision = sourceIdentity(); assert.equal(revision.dirty, false);
const directory = resolve(".sites-runtime/koru-production/shared-rollouts");
mkdirSync(directory, { recursive: true, mode: 0o700 });
for (const path of [resolve(".sites-runtime"), resolve(".sites-runtime/koru-production"), directory]) {
  const stat = lstatSync(path); assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o077) === 0);
}
function privateRead(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { const stat = lstatSync(path); assert.ok(stat.isFile() && stat.uid === process.getuid() && (stat.mode & 0o077) === 0); return readFileSync(fd); }
  finally { closeSync(fd); }
}
const id = randomUUID(), journalPath = resolve(directory, id + ".json"), configPath = resolve(directory, id + "-wrangler.json");
assert.ok(!existsSync(journalPath) && !existsSync(configPath));
const journal = { ...revision, id, migrationDigest: sharedGroupMigrationPlan().digest, phase: "preflight", worker: production.worker, assessment };
function checkpoint(phase) {
  journal.phase = phase; journal.updatedAt = new Date().toISOString();
  writeFileSync(journalPath, JSON.stringify(journal, null, 2), { mode: 0o600 });
  console.log("Shared group rollout: " + phase);
}
const auth = JSON.parse(run("node_modules/wrangler/bin/wrangler.js", ["auth", "token", "--json"]));
assert.ok(["oauth", "api_token"].includes(auth.type) && auth.token);
const root = `/accounts/${production.accountId}`, settingsPath = `${root}/workers/scripts/${production.worker}/settings`;
const queryPath = `${root}/d1/database/${production.canonicalDatabaseId}/query`;
async function api(path, body) {
  assert.ok(path === settingsPath && !body || path === queryPath && body);
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, { method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(60_000),
    headers: { Authorization: "Bearer " + auth.token, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  assert.ok(response.ok && result.success === true && !result.result?.some?.((item) => item.success === false), "SHARED_ROLLOUT_PROVIDER_FAILURE; details withheld");
  return result.result;
}
const query = async (sql) => (await api(queryPath, { sql })).flatMap((item) => item.results ?? []);
async function expect(path, status) {
  for (let i = 0; i < 60; i++) {
    try { const response = await fetch(production.origin + path, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(5000) });
      await response.body?.cancel(); if (response.status === status) return;
    } catch { /* Bounded propagation check; never disable TLS verification. */ }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw Error("SHARED_ROLLOUT_HTTPS_CHECK_FAILED");
}
function deploy(config) {
  assert.deepEqual(sourceIdentity(), revision, "Source changed after approval");
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  run("node_modules/wrangler/bin/wrangler.js", ["deploy", "--config", configPath, "--dry-run"]);
  run("node_modules/wrangler/bin/wrangler.js", ["deploy", "--config", configPath]);
}
try {
  const settings = await api(settingsPath), bindings = settings.bindings ?? [];
  assert.deepEqual(productionBindingFailures(bindings), []);
  assert.ok(!bindings.some((b) => b.name === "SHARED_GROUPS_ENABLED" && b.text === "true"), "Already enabled; do not replay this rollout");
  const pools = productionPools.map((pool) => {
    const binding = bindings.find((item) => item.type === "d1" && item.name === pool.binding);
    assert.ok(binding?.database_id && binding.database_id !== production.canonicalDatabaseId);
    return { ...pool, database_id: binding.database_id };
  });
  assert.equal(bindings.filter((item) => item.type === "d1").length, pools.length + 1);
  assert.equal((await query("SELECT count(*) AS n FROM account_erasure_jobs WHERE completed_at IS NULL"))[0].n, 0, "Pending erasure requires operator review");
  assert.equal((await query("SELECT count(*) AS n FROM sqlite_master WHERE name GLOB 'shared_*'"))[0].n, 0, "Shared schema already exists or is partial; inspect journal, never blindly retry");
  const built = JSON.parse(readFileSync("dist/server/wrangler.json", "utf8"));
  checkpoint("maintenance-deploying");
  deploy(productionDeploymentConfig(built, pools, { maintenance: true, domains: true }));
  await expect("/login", 503); await new Promise((r) => setTimeout(r, 60_000)); checkpoint("drained");
  const output = run("scripts/backup-production-d1.mjs", ["--confirm=production-backup-export-only"]);
  const backup = JSON.parse(output.slice(output.indexOf("{")));
  assert.ok(backup.status === "passed" && backup.localRestoreVerified && backup.scope === "approved-production-export-and-offline-restore-only");
  assert.match(backup.runId, /^[a-f0-9-]{36}$/); journal.backupId = backup.runId; checkpoint("backed-up");
  const base = resolve(".sites-runtime/koru-production"), envelope = JSON.parse(privateRead(resolve(base, "backups", backup.runId, "snapshot.aes256gcm.json")));
  assert.equal(envelope.metadata.sourceDatabaseId, production.canonicalDatabaseId);
  assert.ok(Date.now() - Date.parse(envelope.metadata.exportedAt) < 3600_000);
  const key = privateRead(resolve(base, "backup-keys", backup.runId + ".key"));
  let db;
  try { db = openSnapshot(openSql(JSON.stringify(envelope), key, envelope.metadata)); } finally { key.fill(0); }
  try {
    db.exec("PRAGMA foreign_keys=ON");
    const before = describeSnapshot(db), rehearsal = await rehearseSharedGroupMigration(db), after = describeSnapshot(db);
    assert.equal(rehearsal.migrationDigest, journal.migrationDigest);
    await verifySnapshot(before, query); checkpoint("schema-applying");
    const plan = sharedGroupMigrationPlan(); assert.equal(plan.digest, journal.migrationDigest);
    const result = await api(queryPath, { batch: plan.batch });
    assert.equal(result.length, plan.batch.length); assert.ok(result.every((item) => item.success === true));
    await verifySnapshot(after, query); checkpoint("schema-verified");
  } finally { db.close(); }
  deploy(productionDeploymentConfig(built, pools, { domains: true, sharedGroups: true }));
  assert.deepEqual(productionBindingFailures((await api(settingsPath)).bindings ?? []), []);
  await expect("/login", 200); await expect("/api/state", 401);
  checkpoint("opened");
  console.log("Existing groups preserved; new groups use shared storage. No staging import, paid plan or remote synthetic account/mail.");
} catch {
  journal.failed = true; checkpoint(journal.phase);
  throw Error("SHARED_ROLLOUT_STOPPED; inspect private journal. Never replay blindly, drop shared tables, restore over newer writes or roll back to a shared-unaware binary.");
}
