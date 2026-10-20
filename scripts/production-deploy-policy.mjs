import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { production } from "./web-production-policy.mjs";
import { legacyMigrations, productionMigrationPlan } from "./production-migration-policy.mjs";

export const productionZoneId = "e393d28791c07b7030be5736591d6d37";
export const productionPools = Object.freeze([
  { binding: "GROUP_CREATE_ONE", database_name: "koru-production-group-1" },
  { binding: "GROUP_CREATE_TWO", database_name: "koru-production-group-2" },
]);
export function productionDeploymentConfig(built, pools = [], { maintenance = false, domains = false } = {}) {
  assert.ok(built.main === "index.js" && built.assets?.directory === "../client" && built.no_bundle === true);
  assert.equal(built.compatibility_date, "2026-05-15");
  assert.deepEqual(built.compatibility_flags, ["nodejs_compat"]);
  assert.ok(pools.length === 0 && maintenance || pools.length === productionPools.length);
  for (const pool of pools) {
    assert.ok(productionPools.some((item) => item.binding === pool.binding && item.database_name === pool.database_name));
    assert.match(pool.database_id, /^[a-f0-9-]{36}$/);
    assert.notEqual(pool.database_id, production.canonicalDatabaseId);
  }
  assert.equal(new Set(pools.map((pool) => pool.database_id)).size, pools.length);
  assert.equal(new Set(pools.map((pool) => pool.binding)).size, pools.length);
  const origin = maintenance && !domains ? production.legacyOrigin : production.origin;
  const vars = { APPLICATION_BRAND: "Koru", SUPPORT_EMAIL: "koru.destek@gmail.com", AUTH_PUBLIC_ORIGIN: origin,
    MAINTENANCE_MODE: maintenance ? "true" : "false", STAGING_ENVIRONMENT: "false", SELF_SERVICE_LOCAL: "false",
    READING_GROUPS_ENABLED: pools.length ? "true" : "false", SELF_SERVICE_ENABLED: pools.length ? "true" : "false",
    FACE_RECOGNITION_ENABLED: "false", PASSWORD_HASH_ITERATIONS: "100000",
    READING_GROUP_DB_BINDINGS: JSON.stringify(pools.map((pool) => pool.binding)), SELF_SERVICE_GROUP_BINDINGS: JSON.stringify(pools.map((pool) => pool.binding)),
    PRIVACY_POLICY_URL: production.origin + "/privacy", TERMS_URL: production.origin + "/terms", TURNSTILE_SITE_KEY: production.turnstileSiteKey,
    ...(pools.length ? { AUTH_PROVIDER: "firebase", FIREBASE_PROJECT_ID: production.firebaseProjectId } : {}) };
  return { name: production.worker, account_id: production.accountId, main: resolve("dist/server/index.js"), no_bundle: true,
    compatibility_date: built.compatibility_date, compatibility_flags: built.compatibility_flags, rules: built.rules,
    assets: { directory: resolve("dist/client") }, workers_dev: true, preview_urls: false, observability: { enabled: true },
    d1_databases: [{ binding: "DB", database_name: "okuma-halkasi-db", database_id: production.canonicalDatabaseId }, ...pools], vars,
    ...(domains ? { routes: ["birkoru.com", "www.birkoru.com"].map((pattern) => ({ pattern, custom_domain: true, zone_id: productionZoneId })) } : {}) };
}
export function migrationBatch(files, seed = []) {
  const batch = files.flatMap((file) => file.sql.split("--> statement-breakpoint").map((sql) => ({ sql: sql.trim(), params: [] }))).filter((item) => item.sql);
  batch.push(...seed);
  assert.ok(batch.length > 0 && batch.length < 200 && batch.every((item) => Buffer.byteLength(item.sql) < 100000 && item.params.length <= 100));
  return { batch };
}
export function canonicalProductionBatch() { const plan = productionMigrationPlan(); return migrationBatch(plan.files, plan.seed); }
export function domainProductionBatch() {
  return migrationBatch([...legacyMigrations, "0010_group_account_links"].map((name) => ({ sql: readFileSync(resolve("drizzle", name + ".sql"), "utf8") })));
}
