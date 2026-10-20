import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { constants, existsSync, lstatSync, mkdirSync, openSync, closeSync, readFileSync, writeFileSync, realpathSync } from "node:fs";
import { resolve, sep } from "node:path";
import { production, productionBindingFailures } from "./web-production-policy.mjs";
import { productionZoneId, productionPools, productionDeploymentConfig, canonicalProductionBatch, domainProductionBatch } from "./production-deploy-policy.mjs";
import { approvedProductionFirebaseConfig, preflightProductionFirebase } from "./firebase-production-policy.mjs";
import { catalogSql, describeSnapshot, digest, openSnapshot, openSql, verifySnapshot } from "./d1-backup-policy.mjs";
import { rehearseProductionMigration, productionMigrationPlan } from "./production-migration-policy.mjs";
import { firstPublicLaunchAssessment } from "./first-public-launch-policy.mjs";
import { sourceIdentity } from "./release-source.mjs";

const [action, ...args] = process.argv.slice(2);
assert.ok(["preflight", "maintenance", "migrate", "open", "status"].includes(action), "Use preflight, maintenance, migrate, open or status");
assert.ok(args.every((arg) => ["--confirm=koru-public-production", "--suite=", "--evidence=", "--decision="].some((prefix) => arg === prefix || arg.startsWith(prefix.endsWith("=") ? prefix : "!"))));
const writes = ["maintenance", "migrate", "open"].includes(action);
if (writes) assert.ok(args.includes("--confirm=koru-public-production"), "Explicit production write confirmation required");
const directory = resolve(".sites-runtime/koru-production"), statePath = resolve(directory, "cutover.json");
const option = (name) => args.find((arg) => arg.startsWith(name + "="))?.slice(name.length + 1);
const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const delay = (ms) => new Promise((r) => setTimeout(r, ms));
const identity = sourceIdentity();
assert.equal(identity.dirty, false, "Commit reviewed source before production operations");
function privateDirectory(path) {
  mkdirSync(path, { recursive: true, mode: 0o700 });
  const stat = lstatSync(path);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid() && (stat.mode & 0o077) === 0);
}
for (const path of [resolve(".sites-runtime"), directory]) privateDirectory(path);
function privateRead(path) {
  const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try { const stat = lstatSync(path); assert.ok(stat.isFile() && stat.uid === process.getuid() && (stat.mode & 0o077) === 0); return readFileSync(fd); }
  finally { closeSync(fd); }
}
function save(path, value) {
  if (existsSync(path)) { const stat = lstatSync(path); assert.ok(stat.isFile() && !stat.isSymbolicLink() && (stat.mode & 0o077) === 0 && stat.uid === process.getuid()); }
  writeFileSync(path, JSON.stringify(value, null, 2), { mode: 0o600 });
}
const state = existsSync(statePath) ? JSON.parse(privateRead(statePath)) : { ...identity, worker: production.worker, phase: "not-started", pools: [] };
assert.equal(state.worker, production.worker);
assert.equal(state.commit, identity.commit, "Cutover state is pinned to another revision; operator review required");
assert.equal(state.sourceDigest, identity.sourceDigest);
function checkpoint(phase) { state.phase = phase; state.updatedAt = new Date().toISOString(); save(statePath, state); console.log("Production phase: " + phase); }
function cli(args, input) {
  const result = spawnSync(process.execPath, [resolve("node_modules/wrangler/bin/wrangler.js"), ...args], {
    encoding: "utf8", input, timeout: 240_000, maxBuffer: 16 * 1024 * 1024,
    env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: production.accountId, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", CI: "1" },
  });
  if (result.status !== 0) {
    save(resolve(directory, "last-cli-failure.json"), { command: args[0], status: result.status, stdout: result.stdout, stderr: result.stderr });
    throw Error("PRODUCTION_CLI_FAILED; private diagnostic saved");
  }
  return result.stdout;
}
const auth = JSON.parse(cli(["auth", "token", "--json"]));
assert.ok(["oauth", "api_token"].includes(auth.type) && auth.token);
const account = `/accounts/${production.accountId}`, worker = `${account}/workers/scripts/${production.worker}`, databaseRoot = `${account}/d1/database`;
async function api(path, method = "GET", body) {
  const allowed = method === "GET" ? [worker + "/settings", worker + "/deployments", databaseRoot + "?per_page=100", `${account}/workers/domains`, "/zones/" + productionZoneId,
    `${account}/workers/scripts/koru-staging/settings`, `${account}/workers/scripts/koru-public-info/settings`].includes(path)
    : method === "POST" ? path === databaseRoot && productionPools.some((pool) => pool.database_name === body?.name)
      || [production.canonicalDatabaseId, ...state.pools.map((pool) => pool.database_id)].some((id) => path === databaseRoot + "/" + id + "/query")
    : method === "PUT" ? path === worker + "/secrets" && ["FIREBASE_API_KEY", "ERASURE_OPERATOR_SECRET"].includes(body?.name)
    : method === "DELETE" && ["MEMBER_CREDENTIALS", "GMAIL_CREDENTIALS", "RESEND_API_KEY", "SELF_SERVICE_TEST_EMAILS"].some((name) => path === worker + "/secrets/" + name);
  assert.ok(allowed && (method === "GET" || writes), "Request outside production allowlist");
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, { method, redirect: "error", signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json();
  if (!response.ok || data.success !== true || data.result?.some?.((item) => item.success === false)) {
    save(resolve(directory, "last-api-failure.json"), { method, path, status: response.status, errors: data.errors });
    throw Error("PRODUCTION_API_HTTP_" + response.status + "; private diagnostic saved");
  }
  return data.result;
}
async function query(id, sql) {
  // All queries here are reviewed reads; migration writes use atomic batches below.
  const result = await api(databaseRoot + "/" + id + "/query", "POST", { sql });
  return result.flatMap((item) => item.results ?? []);
}
async function applyBatch(id, body) {
  const result = await api(databaseRoot + "/" + id + "/query", "POST", body);
  assert.equal(result.length, body.batch.length);
  assert.ok(result.every((item) => item.success === true));
}
const settings = await api(worker + "/settings");
const bindings = settings.bindings ?? [];
assert.ok(bindings.some((item) => item.name === "DB" && item.type === "d1" && item.database_id === production.canonicalDatabaseId));
for (const name of ["SESSION_SECRET", "TURNSTILE_SECRET_KEY"]) assert.ok(bindings.some((item) => item.name === name && item.type === "secret_text"), "Required existing Secret missing: " + name);
const zone = await api("/zones/" + productionZoneId);
assert.ok(zone.name === "birkoru.com" && zone.account?.id === production.accountId && zone.status === "active" && zone.plan?.name === "Free Website");
const inventory = await api(databaseRoot + "?per_page=100");
assert.ok(inventory.length < 100 && inventory.length <= 10 && inventory.every((db) => Number.isSafeInteger(db.file_size) && db.file_size >= 0)
  && inventory.reduce((sum, db) => sum + db.file_size, 0) < 5 * 1024 ** 3);
const domains = await api(`${account}/workers/domains`);
assert.ok(Array.isArray(domains) && domains.length < 100);
assert.ok(domains.every((item) => !["birkoru.com", "www.birkoru.com"].includes(item.hostname) || item.service === production.worker), "Domain already serves an unreviewed Worker");
const other = {};
for (const name of ["koru-staging", "koru-public-info"]) other[name] = digest(JSON.stringify(await api(`${account}/workers/scripts/${name}/settings`)));
if (state.otherWorkers) assert.deepEqual(other, state.otherWorkers, "Unrelated Worker configuration changed");
const firebase = approvedProductionFirebaseConfig(JSON.parse(privateRead(resolve(directory, "firebase-web-config.json"))));
assert.equal((await preflightProductionFirebase(firebase)).status, "passed");
function gate() {
  const evidence = readJson(option("--evidence")), decision = readJson(option("--decision"));
  const assessment = firstPublicLaunchAssessment({ suite: readJson(option("--suite")), audit: readJson("outputs/web-security/dependency-audit.json"), evidence, current: identity,
    proofExists(path) { try { return realpathSync(path).startsWith(resolve("outputs/web-acceptance") + sep) && lstatSync(path).isFile() && lstatSync(path).size > 0; } catch { return false; } } }, decision);
  assert.deepEqual(assessment.failures, [], "Technical gate or operator first-launch decision incomplete");
  return assessment;
}
function deploy(config) {
  const path = resolve(directory, "wrangler-production.json"); save(path, config);
  cli(["deploy", "--config", path, "--dry-run"]);
  cli(["deploy", "--config", path]);
}
async function expectStatus(origin, path, status) {
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      const response = await fetch(origin + path, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(5000) });
      await response.body?.cancel(); if (response.status === status) return;
    } catch { /* Bounded DNS/TLS/Worker propagation wait. */ }
    await delay(1000);
  }
  throw Error("PRODUCTION_HTTPS_EXPECTATION_FAILED");
}
const built = readJson("dist/server/wrangler.json");
try {
  if (action === "preflight" || action === "status") {
    console.log(JSON.stringify({ phase: state.phase, revision: identity.commit, zone: zone.status, databaseCount: inventory.length,
      canonicalDatabasePreserved: true, productionPools: state.pools.length, domains: domains.filter((d) => d.service === production.worker).map((d) => d.hostname),
      runtimeBlockers: productionBindingFailures(bindings), remoteWrites: 0 }, null, 2));
  } else if (action === "maintenance") {
    const assessment = gate();
    assert.equal(state.phase, "not-started");
    assert.deepEqual(bindings.filter((item) => item.type === "d1").map((item) => ({ name: item.name, id: item.database_id })), [{ name: "DB", id: production.canonicalDatabaseId }]);
    state.otherWorkers = other; state.assessment = assessment;
    checkpoint("maintenance-deploying");
    deploy(productionDeploymentConfig(built, [], { maintenance: true }));
    await expectStatus(production.legacyOrigin, "/login", 503);
    checkpoint("maintenance");
    console.log("Maintenance verified. Allowing 60 seconds for pre-deployment HTTP work to drain; this is not erasure approval.");
    await delay(60_000);
    state.drainedAt = new Date().toISOString(); checkpoint("drained");
  } else if (action === "migrate") {
    assert.ok(["drained", "backup-ready", "pools-ready", "canonical-applying", "canonical-ready"].includes(state.phase));
    assert.ok(bindings.some((item) => item.name === "MAINTENANCE_MODE" && item.text === "true"));
    await expectStatus(production.legacyOrigin, "/login", 503);
    if (!state.backupId) {
      const backup = spawnSync(process.execPath, ["scripts/backup-production-d1.mjs", "--confirm=production-backup-export-only"], { encoding: "utf8", timeout: 240_000, maxBuffer: 8 * 1024 * 1024, env: process.env });
      assert.equal(backup.status, 0, "Fresh encrypted export failed; no migration allowed");
      const report = JSON.parse(backup.stdout.slice(backup.stdout.indexOf("{")));
      assert.ok(report.status === "passed" && report.localRestoreVerified && report.scope === "approved-production-export-and-offline-restore-only");
      state.backupId = report.runId; checkpoint("backup-ready");
    }
    assert.match(state.backupId, /^[a-f0-9-]{36}$/);
    const envelope = JSON.parse(privateRead(resolve(directory, "backups", state.backupId, "snapshot.aes256gcm.json")));
    assert.equal(envelope.metadata.sourceDatabaseId, production.canonicalDatabaseId);
    assert.ok(Date.now() - Date.parse(envelope.metadata.exportedAt) < 2 * 3600_000, "Cutover backup is stale");
    const key = privateRead(resolve(directory, "backup-keys", state.backupId + ".key"));
    const db = openSnapshot(openSql(JSON.stringify(envelope), key, envelope.metadata)); key.fill(0);
    try {
      const before = describeSnapshot(db);
      // No bootstrap-only account may disappear when the old bootstrap Secret is removed.
      assert.equal(db.prepare("SELECT count(*) AS n FROM members m WHERE is_guest=0 AND NOT EXISTS(SELECT 1 FROM member_accounts a WHERE a.member_id=m.id)").get().n, 0);
      const rehearsal = await rehearseProductionMigration(db);
      assert.equal(rehearsal.legacyAccounts.total, rehearsal.legacyAccounts.knownLegacyHashFormat);
      const expected = describeSnapshot(db);
      state.migrationDigest = productionMigrationPlan().digest;
      state.preservedRows = before.tables.reduce((n, table) => n + table.count, 0);
      state.preservedTables = before.tables.length; state.legacyAccounts = rehearsal.legacyAccounts.total;
      const currentSchema = await query(production.canonicalDatabaseId, catalogSql);
      if (digest(JSON.stringify(currentSchema)) !== expected.schemaDigest) {
        await verifySnapshot(before, (sql) => query(production.canonicalDatabaseId, sql));
        checkpoint("canonical-applying");
        await applyBatch(production.canonicalDatabaseId, canonicalProductionBatch());
      }
      // Validate every old byte AND every exact new seed before allowing access.
      await verifySnapshot(expected, (sql) => query(production.canonicalDatabaseId, sql));
      checkpoint("canonical-ready");
      for (const definition of productionPools) {
        let pool = state.pools.find((item) => item.binding === definition.binding);
        if (!pool) {
          const latest = await api(databaseRoot + "?per_page=100");
          assert.ok(latest.length < 10 && !latest.some((item) => item.name === definition.database_name), "Existing unjournaled pool or Free capacity exhausted");
          const created = await api(databaseRoot, "POST", { name: definition.database_name });
          assert.ok(created.name === definition.database_name && /^[a-f0-9-]{36}$/.test(created.uuid) && !inventory.some((item) => item.uuid === created.uuid));
          pool = { ...definition, database_id: created.uuid }; state.pools.push(pool); save(statePath, state);
        }
        const blank = openSnapshot("");
        try {
          const batch = domainProductionBatch(); for (const item of batch.batch) blank.prepare(item.sql).run(...item.params);
          const expectedPool = describeSnapshot(blank), actual = await query(pool.database_id, catalogSql);
          if (actual.length === 0) await applyBatch(pool.database_id, batch);
          await verifySnapshot(expectedPool, (sql) => query(pool.database_id, sql));
        } finally { blank.close(); }
      }
      checkpoint("pools-ready");
    } finally { db.close(); }
  } else if (action === "open") {
    state.assessment = gate();
    assert.ok(["pools-ready", "domain-maintenance", "opening", "opened"].includes(state.phase));
    assert.equal(state.migrationDigest, productionMigrationPlan().digest);
    assert.equal(state.pools.length, 2);
    const operatorPath = resolve(directory, "erasure-operator.key");
    if (!existsSync(operatorPath)) writeFileSync(operatorPath, randomBytes(32).toString("hex"), { mode: 0o600, flag: "wx" });
    const operatorKey = privateRead(operatorPath).toString("utf8").trim(); assert.match(operatorKey, /^[a-f0-9]{64}$/);
    await api(worker + "/secrets", "PUT", { name: "ERASURE_OPERATOR_SECRET", type: "secret_text", text: operatorKey });
    await api(worker + "/secrets", "PUT", { name: "FIREBASE_API_KEY", type: "secret_text", text: firebase.apiKey });
    // These obsolete credentials are removed only after persisted old accounts are verified.
    for (const name of ["MEMBER_CREDENTIALS", "GMAIL_CREDENTIALS", "RESEND_API_KEY", "SELF_SERVICE_TEST_EMAILS"]) if (bindings.some((item) => item.name === name))
      await api(worker + "/secrets/" + name, "DELETE");
    deploy(productionDeploymentConfig(built, state.pools, { maintenance: true, domains: true }));
    checkpoint("domain-maintenance");
    await expectStatus(production.origin, "/login", 503);
    await expectStatus(production.origin, "/koru.webmanifest", 200);
    checkpoint("opening");
    deploy(productionDeploymentConfig(built, state.pools, { domains: true }));
    const actual = await api(worker + "/settings");
    assert.deepEqual(productionBindingFailures(actual.bindings ?? []), []);
    await expectStatus(production.origin, "/login", 200);
    await expectStatus(production.origin, "/register", 200);
    await expectStatus(production.origin, "/api/members", 401);
    await expectStatus(production.legacyOrigin, "/login", 308);
    for (const name of ["koru-staging", "koru-public-info"]) assert.equal(digest(JSON.stringify(await api(`${account}/workers/scripts/${name}/settings`))), state.otherWorkers[name]);
    state.openedAt = new Date().toISOString(); checkpoint("opened");
    console.log(JSON.stringify({ origin: production.origin, legacyAccountsPreserved: state.legacyAccounts, tablesPreserved: state.preservedTables, rowsPreserved: state.preservedRows,
      permanentNewGroupCapacity: state.pools.length, stagingCopied: false, realProviderAccountsCreated: 0, testMailSent: 0, standardGatePassed: state.assessment.standardGatePassed, pendingChecks: state.assessment.pendingChecks }, null, 2));
  }
} catch (error) {
  save(resolve(directory, "cutover-failure.json"), { phase: state.phase, checkedAt: new Date().toISOString(), message: error instanceof assert.AssertionError ? error.message.split("\n")[0] : String(error.message) });
  console.error("Production stopped at " + state.phase + "; private diagnostic saved. No automatic rollback or data reset was performed.");
  process.exitCode = 1;
}
