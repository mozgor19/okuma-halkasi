import assert from "node:assert/strict";
import test from "node:test";
import { production, productionBindingFailures } from "../web-production-policy.mjs";

function bindings() {
  return [
    { type: "d1", name: "DB", database_id: production.canonicalDatabaseId },
    { type: "d1", name: "GROUP_NEW", database_id: "synthetic-group-id" },
    { type: "plain_text", name: "FACE_RECOGNITION_ENABLED", text: "false" },
    { type: "plain_text", name: "PASSWORD_HASH_ITERATIONS", text: "100000" },
    { type: "plain_text", name: "MAINTENANCE_MODE", text: "false" },
    ...Object.entries({ AUTH_PROVIDER: "firebase", FIREBASE_PROJECT_ID: production.firebaseProjectId, APPLICATION_BRAND: "Koru", AUTH_PUBLIC_ORIGIN: production.origin, READING_GROUPS_ENABLED: "true", SELF_SERVICE_ENABLED: "true", SELF_SERVICE_LOCAL: "false", STAGING_ENVIRONMENT: "false", SUPPORT_EMAIL: "koru.destek@gmail.com", PRIVACY_POLICY_URL: production.origin + "/privacy", TERMS_URL: production.origin + "/terms", TURNSTILE_SITE_KEY: production.turnstileSiteKey, READING_GROUP_DB_BINDINGS: '["GROUP_NEW"]', SELF_SERVICE_GROUP_BINDINGS: '["GROUP_NEW"]' }).map(([name, text]) => ({ type: "plain_text", name, text })),
    ...["SESSION_SECRET", "TURNSTILE_SECRET_KEY", "FIREBASE_API_KEY", "ERASURE_OPERATOR_SECRET"].map((name) => ({ type: "secret_text", name })),
  ];
}
test("public runtime policy requires exact origin, real secret bindings and mapped group capacity", () => {
  assert.deepEqual(productionBindingFailures(bindings()), []);
  assert.equal(production.origin, "https://birkoru.com");
  for (const key of ["AUTH_PROVIDER", "FIREBASE_PROJECT_ID", "AUTH_PUBLIC_ORIGIN", "STAGING_ENVIRONMENT", "SELF_SERVICE_LOCAL", "PRIVACY_POLICY_URL", "TURNSTILE_SECRET_KEY", "GROUP_NEW", "FIREBASE_API_KEY", "ERASURE_OPERATOR_SECRET", "MAINTENANCE_MODE"]) assert.ok(productionBindingFailures(bindings().filter((item) => item.name !== key)).length > 0, key);
});
test("Firebase production cannot fall back to legacy hashing, test identities, emulator or staging mail/bootstrap secrets", () => {
  for (const [name, text] of [["AUTH_PROVIDER", "legacy"], ["FIREBASE_PROJECT_ID", "koru-auth-test"], ["AUTH_PUBLIC_ORIGIN", production.legacyOrigin], ["PASSWORD_HASH_ITERATIONS", "600000"], ["TURNSTILE_SITE_KEY", "synthetic-staging-site"]]) {
    const value = bindings(); value.find((item) => item.name === name).text = text;
    assert.ok(productionBindingFailures(value).length > 0, name);
  }
  for (const name of ["GMAIL_CREDENTIALS", "RESEND_API_KEY", "MEMBER_CREDENTIALS", "FIREBASE_AUTH_EMULATOR_HOST", "FIREBASE_LOCAL_EMULATOR_ORIGIN"]) {
    assert.ok(productionBindingFailures([...bindings(), { type: "secret_text", name }]).some((item) => item.includes("promoted")), name);
  }
});
test("staging, aliased physical databases, plaintext secrets and a test allowlist block public deployment", () => {
  let value = bindings(); value.find((item) => item.name === "DB").database_id = "not-production";
  assert.ok(productionBindingFailures(value).some((item) => item.includes("identity")));
  value = bindings(); value.find((item) => item.name === "GROUP_NEW").database_id = production.canonicalDatabaseId;
  assert.ok(productionBindingFailures(value).some((item) => item.includes("identity")));
  value = bindings(); value.find((item) => item.name === "SESSION_SECRET").type = "plain_text";
  assert.ok(productionBindingFailures(value).some((item) => item.includes("SESSION_SECRET")));
  value = bindings(); value.push({ name: "SELF_SERVICE_TEST_EMAILS", type: "secret_text" });
  assert.ok(productionBindingFailures(value).some((item) => item.includes("allowlist")));
});
