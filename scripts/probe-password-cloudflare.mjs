import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash, pbkdf2Sync, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { production } from "./web-production-policy.mjs";

const worker = "koru-password-probe";
const marker = "KORU_PASSWORD_PROBE_RUN";
const script = resolve("scripts/fixtures/password-runtime-probe.worker.mjs");

export function probeConfiguration(runId) {
  assert.match(runId, /^[a-f0-9-]{36}$/);
  return { name: worker, account_id: production.accountId, main: script, compatibility_date: "2026-05-15", compatibility_flags: ["nodejs_compat"],
    workers_dev: true, preview_urls: false, vars: { [marker]: runId }, observability: { enabled: false } };
}
export function assertProbeConfiguration(config, runId) {
  assert.deepEqual(config, probeConfiguration(runId), "Only an isolated no-storage/no-secret/no-route probe is allowed");
}
export function assertOwnedProbe(settings, runId, expectedDeployment, currentDeployment) {
  assert.deepEqual(settings.bindings, [{ name: marker, type: "plain_text", text: runId }], "Do not remove an unknown or modified Worker");
  assert.ok(expectedDeployment && expectedDeployment === currentDeployment, "Do not remove another deployment");
}

async function run() {
  if (process.argv.length !== 3 || process.argv[2] !== "--confirm=koru-password-probe") throw new Error("Explicit isolated probe approval required: --confirm=koru-password-probe");
  const runId = randomUUID();
  const directory = resolve(".sites-runtime/koru-password-probe");
  mkdirSync(directory, { recursive: true, mode: 0o700 });
  const configPath = resolve(directory, "wrangler.json");
  const config = probeConfiguration(runId);
  assertProbeConfiguration(config, runId);
  writeFileSync(configPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  const cliEnv = { ...process.env, CLOUDFLARE_ACCOUNT_ID: production.accountId, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false" };
  function cli(args) {
    const r = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", ...args], { encoding: "utf8", timeout: 120_000, maxBuffer: 4 * 1024 * 1024, env: cliEnv });
    if (r.status !== 0) throw new Error("Isolated probe CLI operation failed; sensitive provider output withheld: " + args[0]);
    return r.stdout;
  }
  let auth;
  try { auth = JSON.parse(cli(["auth", "token", "--json"])); }
  catch { throw new Error("Cloudflare login unavailable; credentials withheld"); }
  assert.ok(auth.token && ["oauth", "api_token"].includes(auth.type));
  const root = `/accounts/${production.accountId}/workers`;
  const target = `${root}/scripts/${worker}`;
  const protectedWorkers = [production.worker, "koru-staging", "koru-public-info"];
  const reads = new Set([`${root}/subdomain`, `${target}/settings`, `${target}/deployments`,
    ...protectedWorkers.flatMap((name) => [`${root}/scripts/${name}/settings`, `${root}/scripts/${name}/deployments`])]);
  async function api(path, method = "GET", allowAbsent = false) {
    assert.ok(method === "GET" ? reads.has(path) : method === "DELETE" && path === target, "Request outside isolated test scope");
    const response = await fetch("https://api.cloudflare.com/client/v4" + path, { method, redirect: "error", signal: AbortSignal.timeout(20_000), headers: { Authorization: `Bearer ${auth.token}` } });
    const data = await response.json();
    if (allowAbsent && response.status === 404 && data.errors?.some((item) => item.code === 10007)) return null;
    if (!response.ok || !data.success) throw new Error(`Isolated probe metadata/cleanup failed: HTTP ${response.status}; response withheld`);
    return data.result;
  }
  function stable(value) {
    if (Array.isArray(value)) return value.map(stable);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
    return value;
  }
  async function snapshot() {
    const result = {};
    for (const name of protectedWorkers) {
      const settings = await api(`${root}/scripts/${name}/settings`);
      if (name === production.worker) assert.ok(settings.bindings.some((item) => item.name === "DB" && item.database_id === production.canonicalDatabaseId));
      result[name] = { settingsDigest: createHash("sha256").update(JSON.stringify(stable(settings))).digest("hex"), deploymentId: (await api(`${root}/scripts/${name}/deployments`)).deployments?.[0]?.id };
      assert.ok(result[name].deploymentId);
    }
    return result;
  }
  assert.equal((await api(`${root}/subdomain`)).subdomain, "mustafayapayzeka");
  assert.equal(await api(`${target}/settings`, "GET", true), null, "Existing test Worker must not be overwritten");
  const before = await snapshot();
  const report = { checkedAt: new Date().toISOString(), scope: "isolated-synthetic-password-runtime-only", worker, samples: [], cleanup: "not-needed", protectedWorkersUnchanged: null,
    limitations: "No application, DNS, D1, secret or billing change. Successful execution/wall time is not a CPU measurement, sustained-load acceptance or security certification. No plan upgrade is requested." };
  let deployment;
  let attempted = false;
  try {
    cli(["deploy", "--config", configPath, "--dry-run"]);
    assertProbeConfiguration(JSON.parse(readFileSync(configPath, "utf8")), runId);
    attempted = true;
    cli(["deploy", "--config", configPath]);
    deployment = (await api(`${target}/deployments`)).deployments?.[0]?.id;
    assertOwnedProbe(await api(`${target}/settings`), runId, deployment, deployment);
    const origin = `https://${worker}.mustafayapayzeka.workers.dev`;
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const response = await fetch(origin + "/ready", { redirect: "manual", signal: AbortSignal.timeout(5000) });
        if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
          const health = await response.json();
          if (health.probe === "koru-password-probe-v1" && health.runId === runId) { ready = true; break; }
        } else await response.body?.cancel();
      } catch { /* Only deployment reachability is retried, never a failed password result. */ }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    assert.equal(ready, true, "The exact synthetic deployment did not become reachable");
    for (const iterations of [100_000, 200_000, 600_000, 600_000, 600_000]) {
      const sample = { iterations, cpuMilliseconds: null };
      const started = Date.now();
      try {
        const response = await fetch(origin + "/" + iterations, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
        sample.httpStatus = response.status;
        sample.requestWallMs = Date.now() - started;
        if (response.ok && response.headers.get("content-type")?.includes("application/json")) {
          const value = await response.json();
          assert.equal(value.runId, runId);
          assert.equal(value.iterations, iterations);
          sample.supported = value.supported === true;
          sample.reason = value.reason;
          sample.workerWallMs = value.wallMs;
          if (value.supported) {
            const expected = pbkdf2Sync("Synthetic-Koru-Runtime-48296", Buffer.from("0123456789abcdef0123456789abcdef", "hex"), iterations, 32, "sha256").toString("hex");
            assert.equal(value.hash, expected);
            sample.standardVectorMatches = true;
          }
        } else {
          const body = await response.text();
          sample.supported = false;
          sample.reason = /1102|exceeded resource limits/i.test(body) ? "resource-limit" : "unexpected-http-response";
        }
      } catch (error) {
        if (error instanceof assert.AssertionError) throw error;
        sample.supported = false;
        sample.reason = "network-or-timeout";
      }
      report.samples.push(sample);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }
    report.status = "measured";
    report.strongCostSupported = report.samples.filter((item) => item.iterations === 600_000).every((item) => item.supported && item.standardVectorMatches);
  } catch (error) {
    report.status = "failed";
    report.error = error.message;
    throw error;
  } finally {
    if (attempted) {
      try {
        const settings = await api(`${target}/settings`, "GET", true);
        if (settings) {
          const current = (await api(`${target}/deployments`)).deployments?.[0]?.id;
          if (!deployment) throw new Error("Unknown partial deployment; manual cleanup review required");
          assertOwnedProbe(settings, runId, deployment, current);
          await api(target, "DELETE");
        }
        assert.equal(await api(`${target}/settings`, "GET", true), null);
        report.cleanup = "removed-and-absence-verified";
      } catch (error) { report.cleanup = "operator-review-required"; report.cleanupError = error.message; process.exitCode = 1; }
    }
    const after = await snapshot();
    report.protectedWorkersUnchanged = JSON.stringify(before) === JSON.stringify(after);
    if (!report.protectedWorkersUnchanged) process.exitCode = 1;
    writeFileSync(resolve(directory, "report.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(report, null, 2));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) await run();
