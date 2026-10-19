import { randomBytes, pbkdf2Sync } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { staging, stagingDirectory, stagingConfigPath, stagingCredentialsPath, stagingTestEmails, schemaFor, assertBindings, deploymentConfig, assertDeployment, seedFor, applicationTables } from "./staging-policy.mjs";

const [action, confirmation] = process.argv.slice(2);
if (!["status", "init", "prepare", "deploy", "credentials", "mail"].includes(action)) throw new Error("Use status, init, prepare, deploy, credentials or mail");
if (["init", "deploy", "mail"].includes(action) && confirmation !== "--confirm=koru-staging") throw new Error("Remote writes require --confirm=koru-staging");
const cliEnv = { ...process.env, CLOUDFLARE_ACCOUNT_ID: staging.accountId, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false", WRANGLER_LOG: "log" };
function wrangler(args, input) {
  const result = spawnSync(process.execPath, [resolve("node_modules/wrangler/bin/wrangler.js"), ...args], { env: cliEnv, encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024, timeout: 180_000 });
  if (result.status !== 0) throw new Error(`Wrangler ${args[0]} failed; sensitive output withheld`);
  return result.stdout;
}
function privateDirectory() { mkdirSync(stagingDirectory, { recursive: true, mode: 0o700 }); chmodSync(stagingDirectory, 0o700); }
function credentials() {
  if (!existsSync(stagingCredentialsPath)) throw new Error("Staging credentials are missing; never silently reset existing accounts");
  chmodSync(stagingCredentialsPath, 0o600);
  return JSON.parse(readFileSync(stagingCredentialsPath, "utf8"));
}

if (action === "credentials") {
  const state = credentials();
  // Explicit operator-only command. Never used in CI, reports or deployment logs.
  for (const account of state.accounts) console.log(`${account.username}: ${account.password}`);
  process.exit(0);
}

const auth = JSON.parse(wrangler(["auth", "token", "--json"]));
if (!["oauth", "api_token"].includes(auth.type) || !auth.token) throw new Error("Use wrangler login; global API keys are not supported");
const accountPath = `/accounts/${staging.accountId}`;
const workerPath = `${accountPath}/workers/scripts/${staging.worker}`;
async function api(path, method = "GET", body) {
  const databasePath = staging.databases.some((db) => path === `${accountPath}/d1/database/${db.database_id}/query`);
  const allowed = method === "GET" && (path === `${workerPath}/settings` || path === `${accountPath}/d1/database`)
    || method === "POST" && databasePath || method === "PUT" && path === `${workerPath}/secrets`;
  if (!allowed) throw new Error("Cloudflare request outside staging allowlist");
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method, redirect: "error", signal: AbortSignal.timeout(60_000),
    headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok || !data.success || data.result?.some?.((item) => item.success === false)) throw new Error(`Cloudflare ${method} failed (${response.status}); response withheld`);
  return data.result;
}
async function query(database, sql, params = []) {
  if (!staging.databases.includes(database)) throw new Error("Unknown staging database object");
  const result = await api(`${accountPath}/d1/database/${database.database_id}/query`, "POST", { sql, params });
  return result[0]?.results ?? [];
}
const settings = await api(`${workerPath}/settings`);
const siteKey = assertBindings(settings.bindings, { allowUnboundPool: ["status", "init", "prepare", "deploy"].includes(action) });
const inventory = await api(`${accountPath}/d1/database`);
for (const db of staging.databases) if (!inventory.some((item) => item.uuid === db.database_id && item.name === db.database_name)) throw new Error(`Staging database identity mismatch: ${db.binding}`);

async function databaseState(db) {
  const tables = applicationTables(await query(db, "SELECT name FROM sqlite_master WHERE type='table'"));
  if (!tables.length) return { empty: true };
  if (!tables.includes("staging_environment")) throw new Error(`Refusing non-empty unrecognized database: ${db.binding}`);
  const rows = await query(db, "SELECT worker,binding,schema_digest,state FROM staging_environment WHERE singleton=1");
  const marker = rows[0];
  if (rows.length !== 1 || marker.worker !== staging.worker || marker.binding !== db.binding || marker.schema_digest !== schemaFor(db.binding).digest || marker.state !== "ready") throw new Error(`Staging schema needs operator review: ${db.binding}`);
  return { empty: false, ready: true };
}
const states = await Promise.all(staging.databases.map(databaseState));

if (action === "status") {
  console.log(JSON.stringify({ worker: staging.worker, turnstileBindingsPresent: true, gmailSecretPresent: settings.bindings.some((item) => item.name === "GMAIL_CREDENTIALS" && item.type === "secret_text"), databases: staging.databases.map((db, index) => ({ binding: db.binding, name: db.database_name, ...states[index] })) }, null, 2));
} else if (action === "mail") {
  if (states.some((state) => !state.ready)) throw new Error("Staging schemas are not ready");
  const { assertClosedStagingMailTarget, readStagingMailSecret, verifyStagingMailSecret } = await import("./staging-mail-policy.mjs");
  assertClosedStagingMailTarget(settings.bindings);
  const credentials = readStagingMailSecret();
  await verifyStagingMailSecret(credentials);
  await api(`${workerPath}/secrets`, "PUT", { name: "GMAIL_CREDENTIALS", type: "secret_text", text: JSON.stringify(credentials) });
  const updated = await api(`${workerPath}/settings`);
  assertBindings(updated.bindings); assertClosedStagingMailTarget(updated.bindings);
  if (!updated.bindings.some((item) => item.name === "GMAIL_CREDENTIALS" && item.type === "secret_text")) throw new Error("Gmail Worker secret binding is missing");
  console.log("Gmail credential installed only as a staging Worker Secret. Public signup/recovery remain disabled.");
} else if (action === "init") {
  privateDirectory();
  if (!existsSync(stagingCredentialsPath)) {
    if (states.some((state) => !state.empty)) throw new Error("Existing staging DB found without its local credentials; stopping");
    const accounts = ["koru.coklu", "koru.tek"].map((username, index) => {
      const password = `A1${randomBytes(24).toString("base64url")}`;
      const salt = randomBytes(16).toString("hex");
      return { username, name: index === 0 ? "Test Coklu" : "Test Tek", password, salt, hash: pbkdf2Sync(password, Buffer.from(salt, "hex"), 100_000, 32, "sha256").toString("hex"), iterations: 100_000 };
    });
    writeFileSync(stagingCredentialsPath, JSON.stringify({ sessionSecret: randomBytes(48).toString("hex"), accounts }, null, 2), { mode: 0o600, flag: "wx" });
  }
  const state = credentials();
  for (const [index, db] of staging.databases.entries()) {
    if (states[index].ready) { console.log(`${db.binding}: existing staging schema preserved`); continue; }
    // Recheck immediately before writing. A partial/unknown schema is never reset.
    if (!(await databaseState(db)).empty) throw new Error("Database changed during preflight");
    await query(db, "CREATE TABLE staging_environment(singleton INTEGER PRIMARY KEY CHECK(singleton=1),worker TEXT NOT NULL,binding TEXT NOT NULL,schema_digest TEXT NOT NULL,state TEXT NOT NULL)");
    const schema = schemaFor(db.binding);
    await query(db, "INSERT INTO staging_environment VALUES (1,?,?,?,'initializing')", [staging.worker, db.binding, schema.digest]);
    await query(db, schema.sql);
    for (const statement of seedFor(db.binding, state.accounts)) await query(db, statement.sql, statement.params);
    const foreignKeys = await query(db, "PRAGMA foreign_key_check");
    if (foreignKeys.length) throw new Error(`Foreign key check failed: ${db.binding}`);
    await query(db, "UPDATE staging_environment SET state='ready' WHERE singleton=1");
    await databaseState(db);
    console.log(`${db.binding}: schema and synthetic test data ready`);
  }
} else if (action === "prepare") {
  if (states.some((state) => !state.ready)) throw new Error("Initialize all staging schemas before preparing a deployment");
  privateDirectory();
  const built = JSON.parse(readFileSync(resolve("dist/server/wrangler.json"), "utf8"));
  if (confirmation !== undefined && confirmation !== "--onboarding" || process.argv.length > 4) throw new Error("Unknown staging preparation flag");
  const config = deploymentConfig(built, siteKey, { onboarding: confirmation === "--onboarding" });
  assertDeployment(config);
  writeFileSync(stagingConfigPath, JSON.stringify(config, null, 2), { mode: 0o600 });
  console.log("Staging-only deployment configuration prepared; no secrets in artifact");
} else if (action === "deploy") {
  if (states.some((state) => !state.ready)) throw new Error("Staging schemas are not ready");
  const config = JSON.parse(readFileSync(stagingConfigPath, "utf8"));
  assertDeployment(config);
  if (config.vars.TURNSTILE_SITE_KEY !== siteKey) throw new Error("Turnstile changed; prepare again");
  const sessionSecret = credentials().sessionSecret;
  wrangler(["deploy", "--config", stagingConfigPath, "--name", staging.worker, "--dry-run"]);
  console.log("Staging deployment dry run passed");
  if (config.vars.SELF_SERVICE_ENABLED === "true") {
    const { readStagingMailSecret, verifyStagingMailSecret } = await import("./staging-mail-policy.mjs");
    await verifyStagingMailSecret(readStagingMailSecret());
    const smoke = JSON.parse(readFileSync(resolve(stagingDirectory, "gmail-smoke.json"), "utf8"));
    if (smoke.inboxConfirmed !== true || smoke.environment !== staging.worker
      || !settings.bindings.some((item) => item.name === "GMAIL_CREDENTIALS" && item.type === "secret_text")) throw new Error("Verified staging Gmail installation required");
    await api(`${workerPath}/secrets`, "PUT", { name: "SELF_SERVICE_TEST_EMAILS", type: "secret_text", text: JSON.stringify(stagingTestEmails) });
  }
  await api(`${workerPath}/secrets`, "PUT", { name: "SESSION_SECRET", type: "secret_text", text: sessionSecret });
  wrangler(["deploy", "--config", stagingConfigPath, "--name", staging.worker]);
  const deployed = await api(`${workerPath}/settings`);
  assertBindings(deployed.bindings);
  for (const [name, value] of Object.entries(config.vars)) if (!deployed.bindings.some((item) => item.name === name && item.type === "plain_text" && item.text === value)) throw new Error(`Runtime configuration mismatch: ${name}`);
  if (!deployed.bindings.some((item) => item.name === "SESSION_SECRET" && item.type === "secret_text")) throw new Error("Session secret binding missing");
  if (config.vars.SELF_SERVICE_ENABLED === "true" && !deployed.bindings.some((item) => item.name === "SELF_SERVICE_TEST_EMAILS" && item.type === "secret_text")) throw new Error("Staging test allowlist secret missing");
  console.log(`Staging deployed: ${staging.origin}`);
  console.log(config.vars.SELF_SERVICE_ENABLED === "true" ? "Restricted test onboarding enabled. Real Turnstile and email verification remain mandatory. No production changes." : "Registration and recovery disabled. No production changes.");
}
