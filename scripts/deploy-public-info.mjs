import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { infoSite } from "../public-info/site.mjs";
import { assetDigest, assertInfoConfig, infoConfig, infoDirectory } from "./build-public-info.mjs";
import { assertPublicInfoBindings } from "./public-info-policy.mjs";
import { production } from "./web-production-policy.mjs";

if (process.argv.length !== 3 || process.argv[2] !== "--confirm=koru-public-info") throw new Error("Only explicitly approved public-information deployment is supported: --confirm=koru-public-info");
const config = JSON.parse(readFileSync(infoConfig, "utf8"));
assertInfoConfig(config);
const tested = JSON.parse(readFileSync("outputs/koru-public-info/report.json", "utf8"));
function assertArtifact() {
  const age = Date.now() - Date.parse(tested.checkedAt);
  if (tested.status !== "passed" || tested.scope !== "public-information-only" || tested.checks?.length < 22 || tested.errors?.length !== 0
    || !Number.isFinite(age) || age < 0 || age > 86400_000 || tested.assetDigest !== assetDigest()) throw new Error("A matching, recent public-only browser test is required");
  assertInfoConfig(JSON.parse(readFileSync(infoConfig, "utf8")));
}
assertArtifact();
const cliEnv = { ...process.env, CLOUDFLARE_ACCOUNT_ID: infoSite.accountId, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false" };
function cli(args) {
  const result = spawnSync(process.execPath, ["node_modules/wrangler/bin/wrangler.js", ...args], { encoding: "utf8", env: cliEnv, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  if (result.status !== 0) throw new Error(`Public-only Wrangler operation failed (${args[0]}); private provider output withheld`);
  return result.stdout;
}
let auth;
try { auth = JSON.parse(cli(["auth", "token", "--json"])); }
catch { throw new Error("Cloudflare authentication unavailable; private output withheld"); }
if (!auth.token || !["oauth", "api_token"].includes(auth.type)) throw new Error("Cloudflare login required; token withheld");
const root = `/accounts/${infoSite.accountId}/workers`;
async function get(path, allowAbsent = false) {
  const allowed = new Set([`${root}/subdomain`, `${root}/scripts/${infoSite.worker}/settings`, `${root}/scripts/${infoSite.worker}/deployments`, `${root}/scripts/${production.worker}/settings`, `${root}/scripts/${production.worker}/deployments`]);
  if (!allowed.has(path)) throw new Error("Request outside public-info metadata allowlist");
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, { headers: { Authorization: `Bearer ${auth.token}` }, redirect: "error", signal: AbortSignal.timeout(30_000) });
  const data = await response.json();
  if (allowAbsent && response.status === 404 && data.errors?.some((error) => error.code === 10007)) return null;
  if (!response.ok || !data.success) throw new Error(`Public-only Cloudflare metadata read failed (${response.status}); private provider output withheld`);
  return data.result;
}
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}
async function appSnapshot() {
  const settings = await get(`${root}/scripts/${production.worker}/settings`);
  assert.ok(settings.bindings.some((binding) => binding.name === "DB" && binding.database_id === production.canonicalDatabaseId));
  const current = await get(`${root}/scripts/${production.worker}/deployments`);
  return { deploymentId: current.deployments?.[0]?.id,
    settingsDigest: createHash("sha256").update(JSON.stringify(stable(settings))).digest("hex") };
}
if ((await get(`${root}/subdomain`)).subdomain !== "mustafayapayzeka") throw new Error("Account Workers subdomain mismatch");
const existing = await get(`${root}/scripts/${infoSite.worker}/settings`, true);
if (existing) assertPublicInfoBindings(existing.bindings);
const before = await appSnapshot();
if (!before.deploymentId) throw new Error("Existing application deployment identity unavailable");
const report = { status: "prepared", scope: "public-information-only", worker: infoSite.worker, origin: infoSite.origin, assetDigest: tested.assetDigest, checkedAt: new Date().toISOString(), applicationBefore: before, applicationUnchanged: null };
const reportPath = join(infoDirectory, "deployment.json");
function persist() { writeFileSync(reportPath, JSON.stringify(report, null, 2), { mode: 0o600 }); }
persist();
try {
  cli(["deploy", "--config", infoConfig, "--dry-run"]);
  assertArtifact();
  cli(["deploy", "--config", infoConfig]);
  assertPublicInfoBindings((await get(`${root}/scripts/${infoSite.worker}/settings`)).bindings);
  const deployed = await get(`${root}/scripts/${infoSite.worker}/deployments`);
  report.deploymentId = deployed.deployments?.[0]?.id;
  report.versions = deployed.deployments?.[0]?.versions;
  const after = await appSnapshot();
  report.applicationUnchanged = JSON.stringify(before) === JSON.stringify(after);
  if (!report.applicationUnchanged) throw new Error("Existing application metadata changed; review without overwriting or rolling back another operator's work");
  for (const [path, text] of [["/", "Kitaplar, buluşmalar ve okuma grubun."], ["/privacy", "Gizlilik ve kişisel veriler"], ["/terms", "Kullanım koşulları"]]) {
    let verified = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      const response = await fetch(infoSite.origin + path, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
      const html = await response.text();
      if (response.status === 200 && !response.headers.has("set-cookie") && response.headers.get("x-koru-site") === "public-information-v1" && html.includes(text)) { verified = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    if (!verified) throw new Error("Public HTTPS verification pending/failed: " + path);
  }
  assert.equal((await fetch(infoSite.origin + "/api/state", { redirect: "manual" })).status, 404);
  assert.equal((await fetch(infoSite.origin, { method: "POST", redirect: "manual" })).status, 405);
  report.status = "passed";
  report.finishedAt = new Date().toISOString();
  console.log(JSON.stringify({ status: report.status, scope: report.scope, origin: report.origin, deploymentId: report.deploymentId, applicationUnchanged: report.applicationUnchanged, report: reportPath }, null, 2));
} catch (error) {
  report.status = "failed";
  report.error = error.message;
  throw error;
} finally { persist(); }
