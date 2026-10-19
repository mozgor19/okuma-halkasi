import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import * as mimeText from "mimetext/browser";
import { gmailCredentials, GMAIL_REQUEST_TIMEOUT_MS, GMAIL_SEND_SCOPE, sendGmailMail } from "../../lib/gmail-mail.ts";

const require = createRequire(import.meta.url), ts = require("typescript");
const origin = "https://koru-staging.example.com";
const sender = "sender@gmail.com";
function credential() {
  return { environment: "koru-staging", origin, intendedSender: sender, clientId: "123-test.apps.googleusercontent.com", clientSecret: "synthetic-client-secret",
    refreshToken: "synthetic-refresh-token", scope: GMAIL_SEND_SCOPE, authorizedAt: new Date(Date.now() - 60_000).toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString() };
}
const expected = { origin, sender, staging: true };
const env = {}, modules = new Map(), jobs = [], localMessages = [];
function load(name) {
  if (modules.has(name)) return modules.get(name).exports;
  const compiledModule = { exports: {} }; modules.set(name, compiledModule);
  const code = ts.transpileModule(readFileSync(new URL(`../../${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function("require", "module", "exports", code)((specifier) => {
    if (specifier === "cloudflare:workers") return { env };
    if (specifier === "next/server") return { after: (job) => jobs.push(job) };
    if (specifier === "mimetext/browser") return mimeText;
    if (specifier === "@/db/database") return { readingGroupsEnabled: () => true, identityDatabase: () => ({ prepare: (sql) => ({ bind: (...values) => ({ run: async () => localMessages.push({ sql, values }) }) }) }) };
    if (specifier.startsWith("@/")) return load(specifier.slice(2));
    return require(specifier);
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const configuration = load("lib/mail-configuration"), account = load("lib/account-mail"), security = load("lib/onboarding-security");
function configure() {
  for (const key of Object.keys(env)) delete env[key];
  Object.assign(env, { ACCOUNT_MAIL_PROVIDER: "gmail", MAIL_FROM: sender, SUPPORT_EMAIL: sender, AUTH_PUBLIC_ORIGIN: origin, STAGING_ENVIRONMENT: "true", SELF_SERVICE_TEST_EMAILS: '["reader@example.com"]', APPLICATION_BRAND: "Koru", GMAIL_CREDENTIALS: JSON.stringify(credential()) });
  jobs.length = 0; localMessages.length = 0;
}
const mail = () => ({ recipient: "reader@example.com", replyTo: sender, subject: "Koru: \u015eifreni yenile", text: `Ba\u011flant\u0131: ${origin}/reset-password#token=${"a".repeat(64)}\nT\u00fcrk\u00e7e: \u0131\u015f\u0131k, \u00e7\u011f\u00f6\u015f\u00fc.` });
const tokenResponse = () => Response.json({ access_token: "synthetic-access-token", token_type: "Bearer", expires_in: 3600, scope: GMAIL_SEND_SCOPE });

test("Gmail retry request budget leaves room under Cloudflare's 30 second background limit", () => {
  assert.ok(3 * 2 * GMAIL_REQUEST_TIMEOUT_MS + 1000 + 2000 < 30_000);
});

test("Gmail secrets are origin-bound, staging-only, send-only, expiring and never expose extra fields", () => {
  assert.equal(gmailCredentials(JSON.stringify(credential()), expected).scope, GMAIL_SEND_SCOPE);
  for (const data of [{ ...credential(), environment: "production" }, { ...credential(), origin: "https://other.example.com" }, { ...credential(), intendedSender: "other@gmail.com" }, { ...credential(), scope: "https://mail.google.com/" }, { ...credential(), clientSecret: "bad\r\n" }, { ...credential(), refreshToken: "" }, { ...credential(), expiresAt: "invalid" }, { ...credential(), expiresAt: new Date(0).toISOString() }, { ...credential(), expiresAt: new Date(Date.now() + 8 * 86_400_000).toISOString() }, { ...credential(), authorizedAt: new Date(Date.now() + 600_000).toISOString() }]) assert.equal(gmailCredentials(JSON.stringify(data), expected), null);
  assert.equal(gmailCredentials(JSON.stringify(credential()), { ...expected, staging: false }), null);
  assert.equal(gmailCredentials("not-json", expected), null);
  assert.equal("extraSecret" in gmailCredentials(JSON.stringify({ ...credential(), extraSecret: "no-copy" }), expected), false);
});

test("provider selection preserves legacy Resend and never silently falls back for broken Gmail", () => {
  configure();
  assert.equal(configuration.accountMailConfiguration(env).provider, "gmail");
  env.RESEND_API_KEY = "synthetic-resend"; delete env.GMAIL_CREDENTIALS;
  assert.equal(configuration.accountMailConfiguration(env), null);
  delete env.ACCOUNT_MAIL_PROVIDER;
  assert.equal(configuration.accountMailConfiguration(env).provider, "resend");
  env.ACCOUNT_MAIL_PROVIDER = "unknown"; assert.equal(configuration.accountMailConfiguration(env), null);
});

test("Gmail does not bypass legal, support or Turnstile readiness checks", () => {
  configure();
  assert.equal(security.onboardingConfiguration(new Request(origin)).ready, false);
  Object.assign(env, { PRIVACY_POLICY_URL: `${origin}/privacy`, TERMS_URL: `${origin}/terms`, TURNSTILE_SITE_KEY: "site", TURNSTILE_SECRET_KEY: "secret" });
  assert.equal(security.onboardingConfiguration(new Request(origin)).ready, true);
  delete env.GMAIL_CREDENTIALS;
  assert.equal(security.onboardingConfiguration(new Request(origin)).ready, false);
});

test("Gmail uses fixed Google endpoints, a specific mailbox and valid UTF-8 MIME with one recipient", async () => {
  const calls = [];
  const id = await sendGmailMail(credential(), mail(), async (url, options) => { calls.push({ url, options }); return calls.length === 1 ? tokenResponse() : Response.json({ id: "synthetic-message" }); });
  assert.equal(id, "synthetic-message"); assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://oauth2.googleapis.com/token");
  const form = new URLSearchParams(calls[0].options.body);
  assert.equal(form.get("grant_type"), "refresh_token"); assert.equal(form.get("refresh_token"), credential().refreshToken);
  assert.equal(calls[1].url, "https://gmail.googleapis.com/gmail/v1/users/sender%40gmail.com/messages/send");
  for (const call of calls) assert.equal(call.options.redirect, "manual");
  assert.equal(calls[1].options.headers.Authorization, "Bearer synthetic-access-token");
  const raw = JSON.parse(calls[1].options.body).raw;
  assert.match(raw, /^[a-zA-Z0-9_-]+={0,2}$/);
  const mime = Buffer.from(raw, "base64url").toString("utf8");
  assert.match(mime, /From: <sender@gmail.com>\r\n/); assert.match(mime, /To: <reader@example.com>\r\n/);
  assert.match(mime, /Reply-To: <sender@gmail.com>\r\n/); assert.doesNotMatch(mime, /(?:^|\r\n)(?:Bcc|Cc):/);
  const encodedSubject = mime.match(/Subject: =\?utf-8\?B\?([^?]+)\?=/)[1];
  assert.equal(Buffer.from(encodedSubject, "base64").toString("utf8"), mail().subject);
  const body = mime.split("\r\n\r\n")[1];
  assert.equal(Buffer.from(body, "base64").toString("utf8"), mail().text);
  assert.ok(body.split("\r\n").every((line) => line.length <= 76));
  for (const value of [credential().clientSecret, credential().refreshToken, "synthetic-access-token"]) assert.equal(mime.includes(value), false);
});

test("header injection and multiple-recipient input are rejected before any Google request", async () => {
  let calls = 0;
  for (const value of [{ ...mail(), recipient: "a@example.com,b@example.com" }, { ...mail(), recipient: "a@example.com\r\nBcc: b@example.com" }, { ...mail(), replyTo: "a@example.com; b@example.com" }, { ...mail(), subject: "Koru\r\nBcc: a@example.com" }]) await assert.rejects(sendGmailMail(credential(), value, async () => { calls++; return tokenResponse(); }));
  assert.equal(calls, 0);
});

test("invalid or expanded OAuth credentials never reach the send endpoint or echo provider errors", async () => {
  for (const result of [Response.json({ error: "invalid_grant", error_description: "sensitive-provider-details" }, { status: 400 }), Response.json({ access_token: "a", token_type: "Bearer", expires_in: 3600, scope: "https://mail.google.com/" }), Response.json({ access_token: "a", token_type: "Bearer", expires_in: 0 })]) {
    let calls = 0;
    await assert.rejects(sendGmailMail(credential(), mail(), async () => { calls++; return result; }), (error) => error.retryable === false && !error.message.includes("sensitive-provider-details"));
    assert.equal(calls, 1);
  }
});

test("pre-send transient refresh failures can retry but ambiguous send failures cannot", async () => {
  for (const status of [429, 500, 503]) await assert.rejects(sendGmailMail(credential(), mail(), async () => new Response("private", { status })), (error) => error.retryable === true);
  await assert.rejects(sendGmailMail(credential(), mail(), async () => { throw new Error("private-transport-error"); }), (error) => error.retryable === true && !error.message.includes("private"));
  for (const status of [400, 403, 429, 500, 503, 200]) {
    let calls = 0;
    await assert.rejects(sendGmailMail(credential(), mail(), async () => { calls++; return calls === 1 ? tokenResponse() : Response.json({}, { status }); }), (error) => error.retryable === false);
    assert.equal(calls, 2);
  }
});

test("deferred Gmail failures do not auto-send duplicates or log private provider data", async () => {
  configure();
  const originalFetch = globalThis.fetch, originalError = console.error, logs = [];
  let calls = 0;
  globalThis.fetch = async () => { calls++; if (calls === 1) return tokenResponse(); throw new Error("private provider details"); };
  console.error = (...values) => logs.push(values.join(" "));
  try {
    await account.deliverAccountMail(new Request(origin), "reader@example.com", "reset", "a".repeat(64));
    assert.equal(calls, 0); assert.equal(jobs.length, 1);
    await jobs[0]();
    assert.equal(calls, 2); assert.deepEqual(logs, ["Account email delivery failed gmail phase=send status=network reason=network"]);
  } finally { globalThis.fetch = originalFetch; console.error = originalError; }
});

test("Gmail diagnostics expose only stage and HTTP status, never provider bodies or causes", async () => {
  await assert.rejects(sendGmailMail(credential(), mail(), async () => Response.json({ error: "private-provider-details" }, { status: 403 })),
    (error) => error.phase === "refresh" && error.status === 403 && !JSON.stringify(error).includes("private-provider-details"));
  let calls = 0;
  await assert.rejects(sendGmailMail(credential(), mail(), async () => ++calls === 1 ? tokenResponse() : Response.json({ error: "private-provider-details" }, { status: 400 })),
    (error) => error.phase === "send" && error.status === 400 && !JSON.stringify(error).includes("private-provider-details"));
});

test("Resend keeps its idempotency key and account link fragments; local mail never calls a provider", async () => {
  configure(); delete env.ACCOUNT_MAIL_PROVIDER; env.RESEND_API_KEY = "synthetic-resend";
  const original = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return Response.json({ id: "synthetic" }); };
  try {
    const request = new Request(origin);
    await account.sendAccountMail(request, "reader@example.com", "verify", "a".repeat(64));
    assert.equal(calls[0].url, "https://api.resend.com/emails");
    assert.equal(calls[0].options.redirect, "manual");
    assert.match(calls[0].options.headers["Idempotency-Key"], /^verify-[a-f0-9]{64}$/);
    assert.ok(JSON.parse(calls[0].options.body).text.includes(`${origin}/verify-email#token=${"a".repeat(64)}`));
    env.SELF_SERVICE_LOCAL = "true";
    await account.sendAccountMail(new Request("http://127.0.0.1:5184"), "reader@example.com", "reset", "b".repeat(64));
    assert.equal(calls.length, 1);
    assert.ok(localMessages.some((item) => item.sql.startsWith("INSERT INTO development_mail") && item.values[3].includes("/reset-password#token=")));
  } finally { globalThis.fetch = original; }
});
