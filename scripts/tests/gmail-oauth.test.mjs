import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { OAuth2Client } from "google-auth-library";
import { authorizeGmail, createCallbackHandler, findOAuthClient, gmailOAuth, readOAuthClient, saveAuthorization, validatedAuthorization } from "../gmail-oauth.mjs";

const client = { clientId: "123456-test.apps.googleusercontent.com", clientSecret: "synthetic-client-secret", redirectUri: gmailOAuth.redirectUri };
const document = () => ({ web: { client_id: client.clientId, client_secret: client.clientSecret, redirect_uris: [gmailOAuth.redirectUri] } });
function temporary(run) {
  const directory = mkdtempSync(join(tmpdir(), "koru-oauth-test-"));
  try { return run(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

test("OAuth downloads require web credentials and the exact local redirect", () => temporary((directory) => {
  const path = join(directory, "download.json");
  writeFileSync(path, JSON.stringify(document()));
  assert.deepEqual(readOAuthClient(path), client);
  assert.deepEqual(findOAuthClient(directory), client);
  for (const data of [{ installed: document().web }, { web: { ...document().web, redirect_uris: ["https://example.com"] } }, { web: { ...document().web, client_secret: "bad\r\nheader" } }, { web: { ...document().web, client_id: "https://attacker.example" } }]) {
    writeFileSync(path, JSON.stringify(data));
    assert.throws(() => readOAuthClient(path), /OAuth JSON gecersiz/);
  }
  writeFileSync(path, "not-json-or-a-secret-that-must-not-be-echoed");
  assert.throws(() => readOAuthClient(path), (error) => !error.message.includes("must-not-be-echoed"));
  writeFileSync(path, "x".repeat(65_537));
  assert.throws(() => readOAuthClient(path));
  symlinkSync(path, join(directory, "link.json"));
  assert.throws(() => readOAuthClient(join(directory, "link.json")));
}));

test("ambiguous downloads never silently select a different OAuth client", () => temporary((directory) => {
  assert.throws(() => findOAuthClient(directory));
  for (const name of ["first.json", "second.json"]) writeFileSync(join(directory, name), JSON.stringify(document()));
  assert.throws(() => findOAuthClient(directory));
  assert.deepEqual(findOAuthClient(join(directory, "first.json")), client);
}));

const tokens = () => ({ refresh_token: "synthetic-refresh-token", access_token: "synthetic-access-token" });
const info = () => ({ aud: client.clientId, expiry_date: Date.now() + 60_000, scopes: [gmailOAuth.scope] });

test("only offline send-only tokens for the matching OAuth client are persisted", () => {
  const value = validatedAuthorization(client, tokens(), info());
  assert.equal(value.environment, "koru-staging");
  assert.equal(value.intendedSender, gmailOAuth.sender);
  assert.equal(value.senderVerified, false);
  assert.equal(value.refreshToken, tokens().refresh_token);
  assert.equal(JSON.stringify(value).includes(tokens().access_token), false);
  assert.equal(validatedAuthorization(client, tokens(), { ...info(), email: gmailOAuth.sender }).senderVerified, true);
  for (const detail of [{ ...info(), aud: "another-client" }, { ...info(), scopes: [] }, { ...info(), scopes: [gmailOAuth.scope, "https://mail.google.com/"] }, { ...info(), email: "other@gmail.com" }, { ...info(), expiry_date: 0 }]) assert.throws(() => validatedAuthorization(client, tokens(), detail));
  for (const value of [{ access_token: "a" }, { refresh_token: "r" }, {}]) assert.throws(() => validatedAuthorization(client, value, info()));
});

test("production authorization is separate, send-only, and refuses explicitly time-limited refresh grants", () => {
  const value = validatedAuthorization(client, tokens(), info(), Date.now(), { production: true });
  assert.equal(value.environment, "koru-production");
  assert.equal(value.oauthPublishingStatus, "production");
  assert.equal(value.expiresAt, null);
  assert.equal(value.origin, "https://okuma-halkasi.mustafayapayzeka.workers.dev");
  assert.throws(() => validatedAuthorization(client, { ...tokens(), refresh_token_expires_in: 604800 }, info(), Date.now(), { production: true }), /Sureli/);
  assert.equal("oauthPublishingStatus" in validatedAuthorization(client, tokens(), info()), false);
});

test("private authorization storage never overwrites an existing credential or follows a directory symlink", () => temporary((directory) => {
  const path = join(directory, "private", "authorization.json");
  const value = validatedAuthorization(client, tokens(), info());
  saveAuthorization(value, path);
  assert.equal(statSync(join(directory, "private")).mode & 0o777, 0o700);
  assert.equal(statSync(path).mode & 0o777, 0o600);
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), value);
  assert.throws(() => saveAuthorization({ overwritten: true }, path));
  assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), value);
  mkdirSync(join(directory, "target")); symlinkSync(join(directory, "target"), join(directory, "link"));
  assert.throws(() => saveAuthorization(value, join(directory, "link", "authorization.json")), /sembolik/);
}));

function harness({ fail = false, pending } = {}) {
  const calls = { exchanges: [], persisted: [], completed: [] };
  const handler = createCallbackHandler({ state: "synthetic-state", browserToken: "synthetic-browser-token", authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    async exchange(code) { calls.exchanges.push(code); if (pending) await pending; if (fail) throw new Error("sensitive-provider-error"); return { private: "synthetic-token" }; },
    persist(value) { calls.persisted.push(value); }, complete(error) { calls.completed.push(error); },
  });
  async function request(url = "/oauth/callback?state=synthetic-state&code=one-time-code", options = {}) {
    const response = { headers: {}, setHeader(name, value) { this.headers[name.toLowerCase()] = value; }, end(body) { this.body = body; } };
    const headers = { host: "127.0.0.1:53682", cookie: "koru_mail_oauth=synthetic-browser-token", ...options.headers };
    await handler({ method: "GET", url, ...options, headers }, response);
    return response;
  }
  return { calls, request };
}

test("browser entry sets a local HttpOnly Lax cookie and exposes no client secret", async () => {
  const { calls, request } = harness();
  const response = await request("/authorize/synthetic-state");
  assert.equal(response.statusCode, 302);
  assert.match(response.headers["set-cookie"], /HttpOnly; SameSite=Lax; Path=\/oauth\/callback/);
  assert.equal(response.headers.location, "https://accounts.google.com/o/oauth2/v2/auth");
  assert.equal(response.headers["referrer-policy"], "no-referrer");
  assert.equal(response.headers["cache-control"], "no-store");
  assert.deepEqual(calls.exchanges, []);
});

test("host, method, exact state, browser binding and a single code are mandatory", async () => {
  const { calls, request } = harness();
  for (const [url, options, status] of [
    [undefined, { method: "POST" }, 400],
    [undefined, { headers: { host: "attacker.example:53682" } }, 400],
    ["//attacker.example/oauth/callback", {}, 400],
    ["/oauth/callback?code=one", {}, 403],
    ["/oauth/callback?state=wrong&code=one", {}, 403],
    ["/oauth/callback?state=synthetic-state&state=other&code=one", {}, 403],
    [undefined, { headers: { cookie: "" } }, 403],
    ["/oauth/callback?state=synthetic-state&code=one&code=two", {}, 400],
    ["/oauth/callback?state=synthetic-state", {}, 400],
    ["/favicon.ico", {}, 404],
  ]) assert.equal((await request(url, options)).statusCode, status);
  assert.deepEqual(calls.exchanges, []);
  assert.deepEqual(calls.persisted, []);
  assert.equal((await request()).statusCode, 200);
});

test("callbacks are consumed once and cannot race a pending exchange", async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const { calls, request } = harness({ pending });
  const first = request();
  try { assert.equal((await request()).statusCode, 409); } finally { release(); }
  assert.equal((await first).statusCode, 200);
  assert.equal((await request()).statusCode, 409);
  assert.equal(calls.exchanges.length, 1);
  assert.equal(calls.persisted.length, 1);
  assert.deepEqual(calls.completed, [undefined]);
});

test("denial and provider failure never persist credentials or reflect provider errors", async () => {
  for (const fail of [false, true]) {
    const { calls, request } = harness({ fail });
    const response = await request(fail ? undefined : "/oauth/callback?state=synthetic-state&error=access_denied&error_description=secret");
    assert.equal(response.statusCode, fail ? 502 : 400);
    assert.equal(response.body.includes("secret"), false);
    assert.deepEqual(calls.persisted, []);
    assert.equal(calls.completed.length, 1);
    assert.equal(calls.completed[0].message.includes("sensitive-provider-error"), false);
  }
});

test("real loopback listener requests only send scope with offline consent and PKCE, then closes on cancellation", async () => {
  const controller = new AbortController();
  const directory = mkdtempSync(join(tmpdir(), "koru-oauth-listener-"));
  let verify;
  const done = authorizeGmail(client, { signal: controller.signal, timeoutMs: 5000, destination: join(directory, "authorization.json"), onReady(url) {
    verify = (async () => {
      try {
        const response = await fetch(url, { redirect: "manual" });
        assert.equal(response.status, 302);
        const google = new URL(response.headers.get("location"));
        assert.equal(google.origin, "https://accounts.google.com");
        assert.equal(google.searchParams.get("scope"), gmailOAuth.scope);
        assert.equal(google.searchParams.get("redirect_uri"), gmailOAuth.redirectUri);
        assert.equal(google.searchParams.get("access_type"), "offline");
        assert.equal(google.searchParams.get("prompt"), "consent");
        assert.equal(google.searchParams.get("include_granted_scopes"), "false");
        assert.equal(google.searchParams.get("code_challenge_method"), "S256");
        assert.equal(google.searchParams.get("code_challenge").length, 43);
        assert.equal(google.searchParams.get("state"), new URL(url).pathname.split("/").at(-1));
        assert.equal(google.searchParams.has("client_secret"), false);
        await response.text();
      } finally { controller.abort(); }
    })();
    verify.catch(() => {});
  } });
  try {
    await assert.rejects(done, /durduruldu/);
    await verify;
    await assert.rejects(fetch(gmailOAuth.redirectUri));
  } finally { controller.abort(); rmSync(directory, { recursive: true, force: true }); }
});

test("successful local callback persists private refresh credentials and flushes the browser response", async (context) => {
  const directory = mkdtempSync(join(tmpdir(), "koru-oauth-success-"));
  const destination = join(directory, "authorization.json");
  const controller = new AbortController();
  let exchanged;
  let expectedChallenge;
  context.mock.method(OAuth2Client.prototype, "getToken", async (options) => {
    exchanged = options;
    assert.equal(createHash("sha256").update(options.codeVerifier).digest("base64url"), expectedChallenge);
    return { tokens: tokens() };
  });
  context.mock.method(OAuth2Client.prototype, "getTokenInfo", async (accessToken) => { assert.equal(accessToken, tokens().access_token); return info(); });
  let browser;
  const done = authorizeGmail(client, { destination, signal: controller.signal, timeoutMs: 5000, onReady(url) {
    browser = (async () => {
      try {
        const start = await fetch(url, { redirect: "manual" });
        const parameters = new URL(start.headers.get("location")).searchParams;
        expectedChallenge = parameters.get("code_challenge");
        const cookie = start.headers.get("set-cookie").split(";")[0];
        await start.text();
        const callback = new URL(gmailOAuth.redirectUri);
        callback.searchParams.set("state", parameters.get("state"));
        callback.searchParams.set("code", "synthetic-one-time-code");
        const result = await fetch(callback, { headers: { Cookie: cookie } });
        assert.equal(result.status, 200);
        const body = await result.text();
        assert.match(body, /Yetkilendirme kaydedildi/);
        assert.equal(body.includes(tokens().refresh_token), false);
      } catch (error) { controller.abort(); throw error; }
    })();
    browser.catch(() => {});
  } });
  try {
    await done;
    await browser;
    assert.equal(exchanged.code, "synthetic-one-time-code");
    assert.equal(exchanged.redirect_uri, gmailOAuth.redirectUri);
    const saved = JSON.parse(readFileSync(destination, "utf8"));
    assert.equal(saved.refreshToken, tokens().refresh_token);
    assert.equal(saved.senderVerified, false);
    assert.equal(JSON.stringify(saved).includes(tokens().access_token), false);
    assert.equal(statSync(destination).mode & 0o777, 0o600);
  } finally { controller.abort(); rmSync(directory, { recursive: true, force: true }); }
});

test("timeout and an already-aborted operation close the listener without creating credentials", async () => {
  const directory = mkdtempSync(join(tmpdir(), "koru-oauth-timeout-"));
  const destination = join(directory, "authorization.json");
  try {
    await assert.rejects(authorizeGmail(client, { destination, timeoutMs: 20 }), /suresi doldu/);
    const controller = new AbortController(); controller.abort();
    await assert.rejects(authorizeGmail(client, { destination, signal: controller.signal }), /durduruldu/);
    assert.throws(() => statSync(destination), { code: "ENOENT" });
    await assert.rejects(fetch(gmailOAuth.redirectUri));
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
