import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import { constants as fileConstants } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { production } from "./web-production-policy.mjs";
import { assertDrillTarget, assertFreeCapacity, catalogSql, describeSnapshot, digest, identifier,
  openSnapshot, openSql, ownershipTable, restoreSql, sealSql, verifySnapshot } from "./d1-backup-policy.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const base = join(root, ".sites-runtime/koru-production");
const account = `/accounts/${production.accountId}`;
const databasesPath = account + "/d1/database";
const sourcePath = databasesPath + "/" + production.canonicalDatabaseId;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const stable = (value) => Array.isArray(value) ? value.map(stable) : value && typeof value === "object"
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])])) : value;

async function privateDirectory(path) {
  await fs.mkdir(path, { recursive: true, mode: 0o700 });
  const stat = await fs.lstat(path);
  assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === process.getuid(), "Private directory ownership mismatch");
  await fs.chmod(path, 0o700);
}
async function privateFile(path, content) {
  const handle = await fs.open(path, fileConstants.O_WRONLY | fileConstants.O_CREAT | fileConstants.O_EXCL | fileConstants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(content); await handle.sync(); } finally { await handle.close(); }
}
async function readPrivate(path) {
  const handle = await fs.open(path, fileConstants.O_RDONLY | fileConstants.O_NOFOLLOW);
  try {
    const stat = await handle.stat();
    assert.ok(stat.isFile() && stat.uid === process.getuid() && (stat.mode & 0o077) === 0, "Private backup permissions required");
    return await handle.readFile();
  } finally { await handle.close(); }
}
function signedStorageUrl(value) {
  const url = new URL(value);
  assert.ok(url.protocol === "https:" && url.hostname.endsWith(".r2.cloudflarestorage.com")
    && !url.username && !url.password && !url.port && !url.hash, "Unrecognized signed storage host; URL withheld");
  return url;
}
async function readLimited(response, max) {
  if (!response.ok) throw Error("DRILL_STORAGE_HTTP_" + response.status);
  assert.ok(Number(response.headers.get("content-length") || 0) <= max, "Download budget exceeded");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    assert.ok(size <= max, "Download budget exceeded");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function run() {
  const args = process.argv.slice(2);
  const exportOnly = args[0] === "--confirm=production-backup-export-only";
  assert.ok((exportOnly || args[0] === "--confirm=production-backup-and-isolated-restore") && args.length <= 2, "Explicit approved backup confirmation required");
  const backupId = args[1]?.replace(/^--backup-id=/, "");
  if (backupId !== undefined) assert.ok(args[1].startsWith("--backup-id=") && /^[a-f0-9-]{36}$/.test(backupId), "Invalid existing backup identifier");
  const runId = randomUUID(), name = "koru-restore-drill-" + runId;
  for (const path of [join(root, ".sites-runtime"), base, join(base, "backups"), join(base, "backup-keys")]) await privateDirectory(path);
  const directory = join(base, "backups", runId);
  await privateDirectory(directory);
  const reportPath = join(directory, "report.json");
  const report = { runId, checkedAt: new Date().toISOString(), scope: exportOnly ? "approved-production-export-and-offline-restore-only" : "approved-production-backup-isolated-d1-restore-only",
    sourceDatabaseId: production.canonicalDatabaseId, status: "running", phase: "preflight", cleanup: "not-needed",
    sourceSqlWrites: 0, deploymentChanges: 0, paidServicesOpened: false,
    limitations: "One current production D1 snapshot only. No production restore/migration, multi-D1 recovery, erasure replay, automated retention, off-device key recovery or application RTO acceptance." };
  const authResult = spawnSync(process.execPath, [join(root, "node_modules/wrangler/bin/wrangler.js"), "auth", "token", "--json"], {
    encoding: "utf8", timeout: 30000, env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false" },
  });
  let auth;
  try { auth = JSON.parse(authResult.stdout); assert.ok(authResult.status === 0 && auth.token && ["oauth", "api_token"].includes(auth.type)); }
  catch { throw Error("DRILL_AUTH_UNAVAILABLE; sensitive provider output withheld"); }
  let target = null, targetOwned = false, before, existingIds = [], markerWritten = false, creationAttempted = false;
  const workerReads = new Set();
  async function privateFailure(value) {
    if (report.privateFailureSaved) return;
    const key = randomBytes(32);
    await privateFile(join(base, "backup-keys", runId + ".diagnostic.key"), key);
    await privateFile(join(directory, "failure.aes256gcm.json"), sealSql(JSON.stringify(value), key, { runId, purpose: "private-drill-diagnostic" }));
    report.privateFailureSaved = true;
  }
  async function api(path, method = "GET", body) {
    const list = path === databasesPath + "?per_page=100";
    const workerList = path === account + "/workers/scripts";
    const targetQuery = targetOwned && path === databasesPath + "/" + target.uuid + "/query";
    const allowed = method === "GET" ? list || workerList || workerReads.has(path)
      : method === "POST" ? (path === databasesPath && body?.name === name && !target)
        || (path === sourcePath + "/export" && body?.output_format === "polling") || targetQuery
      : method === "DELETE" && targetOwned && path === databasesPath + "/" + target.uuid;
    assert.ok(allowed, "DRILL_REQUEST_OUTSIDE_APPROVED_SCOPE");
    for (let attempt = 0; attempt < 3; attempt++) {
      let response;
      try {
        response = await fetch("https://api.cloudflare.com/client/v4" + path, {
          method, redirect: "error", signal: AbortSignal.timeout(30000),
          headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      } catch { throw Error("DRILL_API_NETWORK; request and provider content withheld"); }
      if (method === "GET" && response.status >= 500 && attempt < 2) { await response.body?.cancel(); await delay(500); continue; }
      let data;
      try { data = await response.json(); } catch { throw Error("DRILL_API_INVALID_RESPONSE"); }
      if (!response.ok || data.success !== true || data.result?.some?.((item) => item.success === false)) {
        await privateFailure(data);
        throw Error("DRILL_API_HTTP_" + response.status + "; private provider content withheld");
      }
      return data.result;
    }
  }
  async function inventory() {
    const list = await api(databasesPath + "?per_page=100");
    assert.ok(Array.isArray(list) && list.length < 100, "Incomplete database inventory");
    return list;
  }
  async function workers() {
    const list = await api(account + "/workers/scripts");
    assert.ok(Array.isArray(list) && list.length <= 30, "Worker inventory exceeds bounded audit");
    const result = {}, bindings = [];
    for (const worker of list) {
      assert.match(worker.id, /^[a-zA-Z0-9_-]{1,63}$/);
      const path = `${account}/workers/scripts/${worker.id}`;
      workerReads.add(path + "/settings"); workerReads.add(path + "/deployments");
      const settings = await api(path + "/settings");
      const deployment = await api(path + "/deployments");
      result[worker.id] = { settings: digest(JSON.stringify(stable(settings))), deployment: deployment.deployments?.[0]?.id };
      bindings.push(...(settings.bindings ?? []));
      if (worker.id === production.worker) assert.deepEqual(settings.bindings.filter((item) => item.type === "d1").map((item) => ({ name: item.name, id: item.database_id })), [{ name: "DB", id: production.canonicalDatabaseId }]);
    }
    assert.ok(result[production.worker] && result["koru-staging"] && result["koru-public-info"]);
    return { fingerprints: result, bindings };
  }
  async function checkTarget(bindings) {
    const actual = (await inventory()).find((item) => item.uuid === target.uuid);
    assert.ok(actual, "Created target is missing");
    assertDrillTarget(actual, { runId, name, existingIds, bindings });
  }
  async function query(sql) {
    const result = await api(databasesPath + "/" + target.uuid + "/query", "POST", { sql });
    assert.ok(Array.isArray(result) && result.every((item) => item.success === true));
    return result.flatMap((item) => item.results ?? []);
  }
  async function pollExport() {
    let bookmark;
    for (let attempt = 0; attempt < 60; attempt++) {
      const value = await api(sourcePath + "/export", "POST", { output_format: "polling", ...(bookmark ? { current_bookmark: bookmark } : {}) });
      if (value.status === "error" || value.success !== true) throw Error("DRILL_EXPORT_FAILED; private details withheld");
      if (value.status === "complete") return value;
      assert.equal(typeof value.at_bookmark, "string");
      bookmark = value.at_bookmark;
      await delay(500);
    }
    throw Error("DRILL_EXPORT_TIMEOUT");
  }
  try {
    const databases = await inventory();
    const source = assertFreeCapacity(databases, production.canonicalDatabaseId);
    assert.ok(!databases.some((item) => item.name === name));
    existingIds = databases.map((item) => item.uuid).sort();
    before = await workers();
    report.capacity = { existingDatabases: databases.length, sourceBytes: source.file_size, databaseCountAndStorageWithinFreeLimits: true, billingSubscriptionVerified: false };
    report.phase = backupId ? "read-existing-encrypted-backup" : "export";
    let sql, metadata;
    const keyPath = join(base, "backup-keys", (backupId ?? runId) + ".key");
    const backupPath = join(base, "backups", backupId ?? runId, "snapshot.aes256gcm.json");
    if (!backupId) {
      console.log("Verified source and isolated target scope; creating a bounded native snapshot.");
      const exported = await pollExport();
      const response = await fetch(signedStorageUrl(exported.result.signed_url), { redirect: "error", credentials: "omit", signal: AbortSignal.timeout(30000) });
      sql = (await readLimited(response, 64 * 1024 * 1024)).toString("utf8");
      metadata = { runId, sourceDatabaseId: production.canonicalDatabaseId, exportedAt: new Date().toISOString(), bookmark: exported.at_bookmark };
      const key = randomBytes(32);
      await privateFile(keyPath, key);
      await privateFile(backupPath, sealSql(sql, key, metadata));
    } else {
      const saved = JSON.parse((await readPrivate(backupPath)).toString("utf8"));
      assert.equal(saved.metadata.runId, backupId);
      assert.equal(saved.metadata.sourceDatabaseId, production.canonicalDatabaseId);
      metadata = saved.metadata;
    }
    // Restore planning must consume the encrypted DISK backup, not the live response.
    const restoredSql = openSql((await readPrivate(backupPath)).toString("utf8"), await readPrivate(keyPath), metadata);
    if (sql !== undefined) assert.equal(digest(restoredSql), digest(sql));
    report.backup = { encrypted: true, keyStoredSeparately: true, diskDecryptVerified: true, sqlBytes: Buffer.byteLength(restoredSql), sha256: digest(restoredSql),
      path: relative(root, backupPath), keyPath: relative(root, keyPath), exportedAt: metadata.exportedAt };
    report.phase = "local-restore-validation";
    const local = openSnapshot(restoredSql);
    let snapshot, planned;
    try { snapshot = describeSnapshot(local); planned = restoreSql(snapshot); } finally { local.close(); }
    const restoreBatch = { batch: planned.statements.map((sql) => ({ sql })) };
    assert.ok(Buffer.byteLength(JSON.stringify(restoreBatch)) < 8 * 1024 * 1024, "Atomic restore batch exceeds this drill budget");
    const rehearsal = openSnapshot("PRAGMA foreign_keys=ON; BEGIN;" + planned.sql + "COMMIT;");
    try { await verifySnapshot(snapshot, async (sql) => rehearsal.prepare(sql).all()); } finally { rehearsal.close(); }
    report.localRestoreVerified = true;
    report.restoreStatementCount = planned.statementCount;
    if (exportOnly) {
      report.status = "passed";
      report.phase = "complete";
      report.remoteRestoreVerified = false;
      return;
    }
    const current = await inventory();
    assertFreeCapacity(current, production.canonicalDatabaseId);
    assert.deepEqual(current.map((item) => item.uuid).sort(), existingIds, "Inventory changed before target creation");
    report.phase = "create-isolated-d1";
    creationAttempted = true;
    const created = await api(databasesPath, "POST", { name });
    target = { uuid: created.uuid, name: created.name };
    assertDrillTarget(target, { runId, name, existingIds, bindings: before.bindings });
    targetOwned = true;
    report.target = target;
    report.cleanup = "pending";
    // Persist cleanup identity before any user records enter the isolated target.
    await privateFile(join(directory, "target.json"), JSON.stringify({ runId, ...target }));
    const currentWorkers = await workers();
    await checkTarget(currentWorkers.bindings);
    assert.deepEqual(await query(catalogSql), [], "New target must be empty");
    await query(`CREATE TABLE ${identifier(ownershipTable)}(run_id TEXT PRIMARY KEY NOT NULL,source_id TEXT NOT NULL);INSERT INTO ${identifier(ownershipTable)} VALUES('${runId}','${production.canonicalDatabaseId}')`);
    markerWritten = true;
    report.phase = "remote-restore";
    console.log("Encrypted disk backup verified; restoring only into this run's unbound temporary D1.");
    const started = Date.now();
    report.restoreTransport = "official-d1-query-batch";
    const restored = await api(databasesPath + "/" + target.uuid + "/query", "POST", restoreBatch);
    assert.ok(Array.isArray(restored) && restored.length === planned.statements.length && restored.every((item) => item.success === true), "Atomic restore batch did not complete");
    report.phase = "remote-integrity-check";
    report.tables = await verifySnapshot(snapshot, query);
    report.restoreAndVerificationMs = Date.now() - started;
    report.remoteRestoreVerified = true;
    report.status = "passed";
    report.phase = "complete";
  } catch (error) {
    report.status = "failed";
    // Never surface assertions, SQL, provider messages, signed URLs or user values.
    report.error = /^DRILL_[A-Z_]+(?:_\d+)?(?:; [a-zA-Z /-]+)?$/.test(error.message) ? error.message : "DRILL_CHECK_FAILED; private details withheld";
    process.exitCode = 1;
  } finally {
    if (creationAttempted && !targetOwned) {
      try {
        const found = (await inventory()).filter((item) => item.name === name);
        assert.ok(found.length <= 1);
        if (found.length) {
          const currentWorkers = await workers();
          assertDrillTarget(found[0], { runId, name, existingIds, bindings: currentWorkers.bindings });
          target = { uuid: found[0].uuid, name };
          targetOwned = true;
          report.target = target;
        }
      } catch { report.cleanup = "operator-review-required"; report.status = "failed"; process.exitCode = 1; }
    }
    if (targetOwned) {
      try {
        const currentWorkers = await workers();
        await checkTarget(currentWorkers.bindings);
        if (markerWritten) assert.deepEqual(await query(`SELECT run_id,source_id FROM ${identifier(ownershipTable)}`), [{ run_id: runId, source_id: production.canonicalDatabaseId }]);
        else assert.ok((await query(catalogSql)).every((item) => item.name === ownershipTable));
        await api(databasesPath + "/" + target.uuid, "DELETE");
        assert.ok(!(await inventory()).some((item) => item.uuid === target.uuid || item.name === target.name));
        report.cleanup = "deleted-and-absence-verified";
      } catch { report.cleanup = "operator-review-required"; report.status = "failed"; process.exitCode = 1; }
    }
    try {
      if (before) {
        const after = await workers();
        report.workerSettingsAndDeploymentsUnchanged = JSON.stringify(stable(before.fingerprints)) === JSON.stringify(stable(after.fingerprints));
        report.existingDatabaseIdentitiesUnchanged = JSON.stringify((await inventory()).map((item) => item.uuid).sort()) === JSON.stringify(existingIds);
        if (!report.workerSettingsAndDeploymentsUnchanged || !report.existingDatabaseIdentitiesUnchanged) { report.status = "failed"; process.exitCode = 1; }
      }
    } catch { report.postflightVerified = false; report.status = "failed"; process.exitCode = 1; }
    report.completedAt = new Date().toISOString();
    await privateFile(reportPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  try { await run(); }
  catch { console.error("Backup drill stopped before execution; private diagnostics withheld."); process.exitCode = 1; }
}
