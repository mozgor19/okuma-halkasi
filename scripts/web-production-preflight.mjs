import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { production, productionBindingFailures } from "./web-production-policy.mjs";
import { sourceIdentity } from "./release-source.mjs";

if (process.argv.length > 2) throw new Error("Read-only command; no arguments, deploy or SQL writes supported.");
const authResult = spawnSync(process.execPath, [resolve("node_modules/wrangler/bin/wrangler.js"), "auth", "token", "--json"], {
  encoding: "utf8", timeout: 30_000, env: { ...process.env, WRANGLER_SEND_METRICS: "false", WRANGLER_WRITE_LOGS: "false" },
});
let token;
try {
  const auth = JSON.parse(authResult.stdout);
  if (authResult.status !== 0 || !["oauth", "api_token"].includes(auth.type) || !auth.token) throw new Error();
  token = auth.token;
} catch { throw new Error("Read-only Cloudflare authentication failed; sensitive output withheld. Use wrangler login."); }
const root = `/accounts/${production.accountId}`;
const settingsPath = `${root}/workers/scripts/${production.worker}/settings`;
const schemaSql = "SELECT name,sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'";
async function read(path, databaseId) {
  if (path !== settingsPath && (!databaseId || path !== `${root}/d1/database/${databaseId}/query`)) throw new Error("Request outside read-only allowlist");
  const response = await fetch("https://api.cloudflare.com/client/v4" + path, {
    method: databaseId ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    ...(databaseId ? { body: JSON.stringify({ sql: schemaSql }) } : {}),
  });
  const result = await response.json();
  if (!response.ok || !result.success || result.result?.some?.((item) => item.success === false)) throw new Error(`Read-only Cloudflare request failed (${response.status}); sensitive response withheld`);
  return result.result;
}
const settings = await read(settingsPath);
const bindings = settings.bindings || [];
const databases = bindings.filter((item) => item.type === "d1");
if (!databases.some((item) => item.name === "DB" && item.database_id === production.canonicalDatabaseId)) throw new Error("Production identity mismatch; no database query was sent.");
const blockers = productionBindingFailures(bindings);
const schemas = [];
const canonicalTables = ["member_accounts", "reading_groups", "reading_group_memberships", "account_profiles", "pending_registrations", "account_recovery_tokens", "account_email_verifications", "security_rate_limits", "group_provisioning", "group_invitations", "group_invitation_redemptions", "account_experience", "account_deletion_requests", "account_erasure_jobs", "firebase_environment", "firebase_registrations", "firebase_links", "firebase_sessions", "account_erasure_provider_checkpoints"];
const domainTables = ["members", "books", "meetings", "attendance", "reviews", "photos", "media", "roadmap", "favorite_books", "book_votes", "club_settings", "meeting_rsvps", "group_account_links", "group_database_ownership"];
for (const database of databases) {
  if (!/^[a-zA-Z][a-zA-Z0-9_]*$/.test(database.name) || !/^[a-f0-9-]{36}$/.test(database.database_id)) throw new Error("Unexpected production database metadata");
  const result = await read(`${root}/d1/database/${database.database_id}/query`, database.database_id);
  const tables = result[0]?.results || [];
  const missing = [...domainTables, ...(database.name === "DB" ? canonicalTables : [])].filter((name) => !tables.some((item) => item.name === name));
  if (database.name === "DB" && bindings.some((item) => item.name === "SHARED_GROUPS_ENABLED" && item.text === "true")) {
    missing.push(...["shared_group_storage", ...domainTables.filter((name) => name !== "group_database_ownership").map((name) => "shared_" + name)]
      .filter((name) => !tables.some((item) => item.name === name)));
  }
  if (missing.length) blockers.push(`Missing reviewed schema on ${database.name}: ${missing.join(", ")}`);
  schemas.push({ binding: database.name, databaseId: database.database_id, tables, missing });
}
const directory = resolve(".sites-runtime/koru-production");
mkdirSync(directory, { recursive: true, mode: 0o700 });
const report = { checkedAt: new Date().toISOString(), ...sourceIdentity(), worker: production.worker, origin: production.origin, operation: "read-only settings and schema inventory", schemas, blockers,
  limitations: "Table presence is not migration approval. Does not inspect secrets, personal records, pool occupancy, OAuth state, backup/restore or external automatic build triggers." };
writeFileSync(resolve(directory, "preflight.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
console.log(JSON.stringify({ worker: report.worker, operation: report.operation, databaseCount: databases.length, blockers, report: ".sites-runtime/koru-production/preflight.json" }, null, 2));
