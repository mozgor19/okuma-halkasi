import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const env = { SESSION_SECRET: "a-test-secret-that-is-at-least-32-characters", READING_GROUPS_ENABLED: "true", SELF_SERVICE_ENABLED: "true", SELF_SERVICE_LOCAL: "true" };
const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const compiledModule = { exports: {} }; modules.set(name, compiledModule);
  const code = ts.transpileModule(readFileSync(new URL(`../../${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", code)((specifier) => specifier === "cloudflare:workers" ? { env } : specifier.startsWith("@/") ? load(specifier.slice(2)) : require(specifier), compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const security = load("lib/onboarding-security");
const policy = load("lib/onboarding-policy");
const local = () => new Request("http://127.0.0.1:5184/api/onboarding/register", { method: "POST", headers: { Origin: "http://127.0.0.1:5184", "Content-Type": "application/json" }, body: "{}" });

test("Local mode cannot bypass production email or challenge requirements", () => {
  assert.equal(security.onboardingConfiguration(local()).ready, true);
  const remote = new Request("https://app.example.com/api/onboarding/register");
  assert.equal(security.localMail(remote), false);
  assert.equal(security.onboardingConfiguration(remote).ready, false);
  assert.throws(() => security.requireSelfService(remote), /henüz/);
});
test("Only exact, explicitly enabled self service opens registration", () => {
  for (const flag of [undefined, "false", "TRUE", "1"]) { env.SELF_SERVICE_ENABLED = flag; assert.throws(() => security.requireSelfService(local()), /bulunamadı/); }
  env.SELF_SERVICE_ENABLED = "true";
  env.READING_GROUPS_ENABLED = "false"; assert.throws(() => security.requireSelfService(local()), /bulunamadı/);
  env.READING_GROUPS_ENABLED = "true";
});
test("Production setup requires valid support, legal URLs, mail and fixed HTTPS origin", () => {
  const remote = new Request("https://app.example.com/api/onboarding/register");
  Object.assign(env, { AUTH_PUBLIC_ORIGIN: "https://app.example.com", RESEND_API_KEY: "key", MAIL_FROM: "noreply@example.com", SUPPORT_EMAIL: "support@example.com", PRIVACY_POLICY_URL: "javascript:alert(1)", TERMS_URL: "https://app.example.com/terms", TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" });
  assert.equal(security.onboardingConfiguration(remote).ready, false);
  env.PRIVACY_POLICY_URL = "https://app.example.com/privacy";
  assert.equal(security.onboardingConfiguration(remote).ready, true);
  assert.doesNotThrow(() => security.requireSelfService(remote));
  env.AUTH_PUBLIC_ORIGIN = "https://APP.example.com/";
  assert.doesNotThrow(() => security.requireSelfService(remote));
  assert.throws(() => security.requireSelfService(new Request("https://other.example.com/api/onboarding/register")), /kaynağı/);
});
test("Mutations reject missing and cross-site origins, regardless of cookies", () => {
  assert.doesNotThrow(() => security.sameOrigin(local()));
  for (const headers of [{}, { Origin: "https://evil.example" }, { Origin: "http://127.0.0.1:5184", "Sec-Fetch-Site": "cross-site" }]) assert.throws(() => security.sameOrigin(new Request(local().url, { method: "POST", headers })), /kaynağı/);
});

test("public Koru cannot register with the legacy or an unknown password work factor", () => {
  env.APPLICATION_BRAND = "Koru";
  const remote = new Request("https://app.example.com/api/onboarding/register");
  try {
    for (const value of [undefined, "100000", "600001", "invalid"]) {
      env.PASSWORD_HASH_ITERATIONS = value;
      assert.equal(security.onboardingConfiguration(remote).ready, false);
    }
    env.PASSWORD_HASH_ITERATIONS = "600000";
    assert.equal(security.onboardingConfiguration(remote).ready, true);
  } finally { delete env.APPLICATION_BRAND; delete env.PASSWORD_HASH_ITERATIONS; }
});
test("staging requires a private exact email allowlist even with working email and Turnstile", () => {
  const remote = new Request("https://app.example.com/api/onboarding/register");
  env.STAGING_ENVIRONMENT = "true";
  try {
    assert.equal(security.onboardingConfiguration(remote).ready, false);
    assert.throws(() => security.requireTestEmail("reader@example.com"), /eksik/);
    for (const invalid of ["[]", "not-json", '["Reader@example.com"]', '["reader@example.com","reader@example.com"]', '["@example.com"]']) {
      env.SELF_SERVICE_TEST_EMAILS = invalid;
      assert.equal(security.onboardingConfiguration(remote).ready, false);
    }
    env.SELF_SERVICE_TEST_EMAILS = '["reader@example.com"]';
    const config = security.onboardingConfiguration(remote);
    assert.equal(config.ready, true); assert.equal(config.restrictedTest, true);
    assert.equal(JSON.stringify(config).includes("reader@example.com"), false);
    assert.doesNotThrow(() => security.requireTestEmail("READER@example.com"));
    for (const address of ["other@example.com", "reader+anything@example.com", "reader@example.com.evil.org", null]) assert.throws(() => security.requireTestEmail(address), /izin/);
    env.STAGING_ENVIRONMENT = "false";
    assert.throws(() => security.requireTestEmail("reader@example.com"), /eksik/);
  } finally { delete env.STAGING_ENVIRONMENT; delete env.SELF_SERVICE_TEST_EMAILS; }
});
test("unapproved staging recipients cannot register, recover, link or enqueue email", async () => {
  env.STAGING_ENVIRONMENT = "true"; env.SELF_SERVICE_TEST_EMAILS = '["reader@example.com"]';
  try {
    const accounts = load("db/onboarding-accounts");
    await assert.rejects(accounts.registerAccount(local(), { name: "Test Reader", username: "new.reader", email: "outsider@example.com", password: "Sample-Password-9324", acceptedPolicy: true }), /izin/);
    await assert.rejects(accounts.requestRecovery(local(), "outsider@example.com"), /izin/);
    await assert.rejects(accounts.linkAccountEmail(local(), 1, { email: "outsider@example.com", password: "Sample-Password-9324" }), /izin/);
    await assert.rejects(load("lib/account-mail").deliverAccountMail(local(), "outsider@example.com", "verify", "a".repeat(64)), /izin/);
  } finally { delete env.STAGING_ENVIRONMENT; delete env.SELF_SERVICE_TEST_EMAILS; }
});
test("JSON parser bounds streamed bodies, media types and object shapes", async () => {
  assert.deepEqual(await security.jsonBody(local()), {});
  for (const body of ["[]", "null", "invalid", JSON.stringify({ data: "x".repeat(9000) })]) await assert.rejects(security.jsonBody(new Request(local().url, { method: "POST", headers: { "Content-Type": "application/json" }, body })));
  await assert.rejects(security.jsonBody(new Request(local().url, { method: "POST", body: "{}" })), /JSON/);
});
test("Production Turnstile validates success, hostname and action on the server", async () => {
  env.AUTH_PUBLIC_ORIGIN = "https://app.example.com"; env.TURNSTILE_SECRET_KEY = "server-secret";
  const original = globalThis.fetch;
  try {
    for (const result of [{ success: false }, { success: true, hostname: "evil.example", action: "register" }, { success: true, hostname: "app.example.com", action: "forgot-password" }]) {
      globalThis.fetch = async () => Response.json(result);
      await assert.rejects(security.verifyChallenge(new Request("https://app.example.com/api/onboarding/register"), "token", "register"));
    }
    globalThis.fetch = async () => Response.json({ success: true, hostname: "app.example.com", action: "register" });
    await security.verifyChallenge(new Request("https://app.example.com/api/onboarding/register"), "token", "register");
  } finally { globalThis.fetch = original; }
});
test("Persistent rate buckets reject parallel excess and never store raw email or IP", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("CREATE TABLE security_rate_limits(key text PRIMARY KEY, count integer, expires_at integer)");
  env.DB = { prepare(sql) { return { bind(...values) { return { async first() { return sqlite.prepare(sql).get(...values); }, async run() { return sqlite.prepare(sql).run(...values); } }; } }; } };
  try {
    const responses = await Promise.allSettled(Array.from({ length: 10 }, () => security.rateLimit(local(), "test", 3, 900, "reader@example.com")));
    assert.equal(responses.filter((result) => result.status === "fulfilled").length, 3);
    const rows = sqlite.prepare("SELECT * FROM security_rate_limits").all();
    assert.equal(rows.length, 1); assert.match(rows[0].key, /^[a-f0-9]{64}$/); assert.equal(rows[0].count, 10);
  } finally { sqlite.close(); }
});
test("Migration preserves old accounts and does not auto-enrol new identities", () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec("CREATE TABLE members(id integer PRIMARY KEY); CREATE TABLE member_accounts(member_id integer PRIMARY KEY); CREATE TABLE reading_groups(id text PRIMARY KEY)");
    sqlite.exec(readFileSync(new URL("../../drizzle/0009_self_service.sql", import.meta.url), "utf8"));
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM account_profiles").get().n, 0);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM group_invitations").get().n, 0);
    assert.equal(policy.POLICY_VERSION, "2026-10-17");
  } finally { sqlite.close(); }
});
test("A physical database cannot be claimed twice, even through two binding aliases", () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec("CREATE TABLE members(id integer PRIMARY KEY)");
    sqlite.exec(readFileSync(new URL("../../drizzle/0010_group_account_links.sql", import.meta.url), "utf8"));
    const claim = sqlite.prepare("INSERT INTO group_database_ownership(singleton, group_id) VALUES (1, ?) ON CONFLICT DO NOTHING");
    claim.run("group-one"); claim.run("group-two");
    assert.equal(sqlite.prepare("SELECT group_id FROM group_database_ownership").get().group_id, "group-one");
    assert.throws(() => sqlite.prepare("INSERT INTO group_database_ownership VALUES (2, 'group-two')").run());
  } finally { sqlite.close(); }
});
test("Concurrent invitations for different groups cannot bypass the account membership quota", async () => {
  const sqlite = new DatabaseSync(":memory:");
  try {
    sqlite.exec("CREATE TABLE members(id integer PRIMARY KEY); CREATE TABLE member_accounts(member_id integer PRIMARY KEY); CREATE TABLE reading_groups(id text PRIMARY KEY); CREATE TABLE reading_group_memberships(account_member_id integer, group_id text)");
    sqlite.exec(readFileSync(new URL("../../drizzle/0009_self_service.sql", import.meta.url), "utf8"));
    sqlite.exec("INSERT INTO members VALUES(1); INSERT INTO reading_groups VALUES('group-a'),('group-b')");
    for (let i = 0; i < 19; i++) sqlite.prepare("INSERT INTO reading_group_memberships VALUES(1, ?)").run(`existing-${i}`);
    const now = Date.now();
    for (const suffix of ["a", "b"]) sqlite.prepare("INSERT INTO group_invitations(id,group_id,token_hash,created_by,created_at,expires_at,max_uses) VALUES(?,?,?,1,?,?,10)").run(`invite-${suffix}`, `group-${suffix}`, `hash-${suffix}`, now, now + 60_000);
    env.DB = { prepare(sql) { return { bind(...values) { return { async run() { const result = sqlite.prepare(sql).run(...values); return { meta: { changes: Number(result.changes) } }; } }; } }; } };
    const groups = load("db/onboarding-groups");
    const results = await Promise.all([groups.reserveInvitation(1, "invite-a", now), groups.reserveInvitation(1, "invite-b", now)]);
    assert.equal(results.reduce((sum, result) => sum + result.meta.changes, 0), 1);
    assert.equal(sqlite.prepare("SELECT count(*) AS n FROM group_invitation_redemptions").get().n, 1);
  } finally { sqlite.close(); }
});
