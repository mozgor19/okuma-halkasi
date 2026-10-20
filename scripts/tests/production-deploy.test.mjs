import assert from "node:assert/strict";
import test from "node:test";
import { canonicalProductionBatch, domainProductionBatch, productionDeploymentConfig, productionPools } from "../production-deploy-policy.mjs";
import { productionBindingFailures } from "../web-production-policy.mjs";
import { openSnapshot } from "../d1-backup-policy.mjs";

const built = { main: "index.js", no_bundle: true, assets: { directory: "../client" }, compatibility_date: "2026-05-15", compatibility_flags: ["nodejs_compat"] };
const pools = productionPools.map((pool, i) => ({ ...pool, database_id: `11111111-1111-4111-8111-${String(i + 1).padStart(12, "0")}` }));
test("public configuration fixes all production identities and contains no credentials or staging resources", () => {
  const config = productionDeploymentConfig(built, pools, { domains: true });
  const bindings = [...config.d1_databases.map((db) => ({ type: "d1", name: db.binding, database_id: db.database_id })),
    ...Object.entries(config.vars).map(([name, text]) => ({ type: "plain_text", name, text })),
    ...["SESSION_SECRET", "TURNSTILE_SECRET_KEY", "FIREBASE_API_KEY", "ERASURE_OPERATOR_SECRET"].map((name) => ({ name, type: "secret_text" }))];
  assert.deepEqual(productionBindingFailures(bindings), []);
  assert.doesNotMatch(JSON.stringify(config), /koru-staging|koru-auth-test|AIza|secret_text|firebase-local/);
  assert.deepEqual(config.routes.map((route) => route.pattern), ["birkoru.com", "www.birkoru.com"]);
  assert.throws(() => productionDeploymentConfig(built, [{ ...pools[0], database_name: "koru-staging-main" }, pools[1]]));
  assert.throws(() => productionDeploymentConfig(built, [pools[0], pools[0]]));
  assert.throws(() => productionDeploymentConfig(built));
  assert.equal(productionDeploymentConfig(built, [], { maintenance: true }).vars.MAINTENANCE_MODE, "true");
});
test("new domain databases have only empty domain tables and no canonical credentials", () => {
  const db = openSnapshot("");
  try {
    for (const item of domainProductionBatch().batch) db.prepare(item.sql).run(...item.params);
    const names = db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map((row) => row.name);
    assert.ok(names.includes("group_account_links"));
    assert.ok(!names.includes("firebase_links") && !names.includes("account_profiles"));
    assert.equal(db.prepare("SELECT count(*) AS n FROM members").get().n, 0);
    assert.equal(db.prepare("SELECT count(*) AS n FROM member_accounts").get().n, 0);
    assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
    assert.ok(!canonicalProductionBatch().batch.some((item) => /DROP TABLE|DELETE FROM|ALTER TABLE.*member_accounts/i.test(item.sql)));
  } finally { db.close(); }
});

test("shared rollout keeps every existing production binding but stops consuming finite empty creation pools", () => {
  const config = productionDeploymentConfig(built, pools, { domains: true, sharedGroups: true });
  assert.equal(config.vars.SHARED_GROUPS_ENABLED, "true");
  assert.equal(config.vars.SELF_SERVICE_GROUP_BINDINGS, "[]");
  assert.deepEqual(config.d1_databases.map((db) => db.binding), ["DB", "GROUP_CREATE_ONE", "GROUP_CREATE_TWO"]);
  const bindings = [...config.d1_databases.map((db) => ({ type: "d1", name: db.binding, database_id: db.database_id })),
    ...Object.entries(config.vars).map(([name, text]) => ({ type: "plain_text", name, text })),
    ...["SESSION_SECRET", "TURNSTILE_SECRET_KEY", "FIREBASE_API_KEY", "ERASURE_OPERATOR_SECRET"].map((name) => ({ name, type: "secret_text" }))];
  assert.deepEqual(productionBindingFailures(bindings), []);
  assert.equal(productionDeploymentConfig(built, pools, { sharedGroups: true, creationPaused: true }).vars.GROUP_CREATION_DISABLED, "true");
});
