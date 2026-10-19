import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { applicationTables, assertBindings, staging, stagingDirectory } from "./staging-policy.mjs";

if (process.argv[2] !== "--confirm=koru-staging") throw new Error("Requires --confirm=koru-staging");
const names = ["koru-staging-create-1", "koru-staging-create-2"];
const receipt = resolve(stagingDirectory, "creation-pool.json");
const result = spawnSync(process.execPath, [resolve("node_modules/wrangler/bin/wrangler.js"), "auth", "token", "--json"], {
  env: { ...process.env, WRANGLER_LOG: "log", WRANGLER_WRITE_LOGS: "false", WRANGLER_SEND_METRICS: "false" }, encoding: "utf8", timeout: 30_000,
});
if (result.status !== 0) throw new Error("Cloudflare authorization failed; output withheld");
const auth = JSON.parse(result.stdout);
if (!["oauth", "api_token"].includes(auth.type) || !auth.token) throw new Error("Cloudflare login required");
const base = `/accounts/${staging.accountId}`;
const known = existsSync(receipt) ? JSON.parse(readFileSync(receipt, "utf8")) : [];
if (!Array.isArray(known) || known.some((db) => !names.includes(db.name) || !/^[a-f0-9-]{36}$/.test(db.uuid))) throw new Error("Invalid pool receipt");
async function api(path, method = "GET", body) {
  const allowed = method === "GET" && [base + "/d1/database", `${base}/workers/scripts/${staging.worker}/settings`].includes(path)
    || method === "POST" && path === base + "/d1/database" && names.includes(body?.name) && Object.keys(body).length === 1
    || method === "POST" && known.some((db) => path === `${base}/d1/database/${db.uuid}/query`)
      && body?.sql === "SELECT name FROM sqlite_master WHERE type='table'";
  if (!allowed) throw new Error("Request outside empty staging pool allowlist");
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    method, redirect: "error", signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`Cloudflare request failed (${response.status}); response withheld`);
  return data.result;
}
assertBindings((await api(`${base}/workers/scripts/${staging.worker}/settings`)).bindings, { allowUnboundPool: true });
const inventory = await api(base + "/d1/database");
const needed = names.filter((name) => !inventory.some((db) => db.name === name));
if (inventory.length + needed.length > 10) throw new Error("Free-plan database capacity would be exceeded");
mkdirSync(stagingDirectory, { recursive: true, mode: 0o700 }); chmodSync(stagingDirectory, 0o700);
for (const name of names) {
  let database = inventory.find((db) => db.name === name);
  if (database && !known.some((db) => db.name === name && db.uuid === database.uuid)) throw new Error("Refusing to adopt an unrecognized existing database");
  if (!database) {
    if (known.some((db) => db.name === name)) throw new Error("Previously created database is missing; review required");
    database = await api(base + "/d1/database", "POST", { name });
    if (database.name !== name || !/^[a-f0-9-]{36}$/.test(database.uuid)) throw new Error("Unexpected database identity");
    known.push({ name: database.name, uuid: database.uuid });
    writeFileSync(receipt, JSON.stringify(known, null, 2), { mode: 0o600 }); chmodSync(receipt, 0o600);
  }
  const rows = await api(`${base}/d1/database/${database.uuid}/query`, "POST", { sql: "SELECT name FROM sqlite_master WHERE type='table'" });
  if (applicationTables(rows[0]?.results || []).length) throw new Error("Pool is no longer empty; do not recreate or reset it");
  console.log(JSON.stringify({ name, id: database.uuid, empty: true }));
}
console.log("Only two empty staging databases created. Existing bindings and data preserved. No paid plan enabled.");
