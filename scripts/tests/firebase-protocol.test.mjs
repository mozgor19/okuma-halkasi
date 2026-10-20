import assert from "node:assert/strict";
import test from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { firebaseConfiguration, FIREBASE_PROJECT, validFirebaseActionCode } from "../../lib/firebase-auth-policy.ts";
import { firebaseClient, firebaseTokens } from "../../lib/firebase-protocol.ts";

const environment = { AUTH_PROVIDER: "firebase", FIREBASE_PROJECT_ID: FIREBASE_PROJECT, FIREBASE_API_KEY: "AIza" + "x".repeat(35), SESSION_SECRET: "Synthetic-test-session-secret-more-than-32",
  AUTH_PUBLIC_ORIGIN: "https://birkoru.com", SELF_SERVICE_ENABLED: "true", READING_GROUPS_ENABLED: "true", SELF_SERVICE_LOCAL: "false" };
const { privateKey, publicKey } = await generateKeyPair("RS256"), publicJwk = await exportJWK(publicKey);
const keys = createLocalJWKSet({ keys: [{ ...publicJwk, kid: "synthetic-key", alg: "RS256", use: "sig" }] });
async function fixture(patch = {}, header = {}) {
  const now = Math.floor(Date.now() / 1000), uid = "synthetic-production-uid", email = "synthetic@example.test";
  const payload = { sub: uid, iss: `https://securetoken.google.com/${FIREBASE_PROJECT}`, aud: FIREBASE_PROJECT, iat: now, exp: now + 3600,
    auth_time: now - 60, email, email_verified: true, firebase: { sign_in_provider: "password" }, ...patch };
  const idToken = await new SignJWT(payload).setProtectedHeader({ alg: "RS256", kid: "synthetic-key", ...header }).sign(privateKey);
  return { tokens: { uid, idToken, refreshToken: "synthetic-private-refresh" }, user: { localId: uid, email, emailVerified: true, validSince: String(now - 120) }, payload };
}

test("production identity configuration is explicitly pinned to the real project/origin and rejects emulator and local bypasses", () => {
  assert.ok(firebaseConfiguration(environment, "https://birkoru.com/api/auth/login"));
  for (const patch of [{ AUTH_PROVIDER: "firebase-local" }, { FIREBASE_PROJECT_ID: "koru-auth-test" }, { FIREBASE_API_KEY: "invalid" }, { SESSION_SECRET: "short" },
    { AUTH_PUBLIC_ORIGIN: "http://birkoru.com" }, { AUTH_PUBLIC_ORIGIN: "https://evil.example" }, { AUTH_PUBLIC_ORIGIN: "https://birkoru.com/" },
    { AUTH_PUBLIC_ORIGIN: "http://127.0.0.1:9999" }, { SELF_SERVICE_LOCAL: "true" }, { SELF_SERVICE_ENABLED: "false" }, { READING_GROUPS_ENABLED: "false" },
    { STAGING_ENVIRONMENT: "true" }, { FIREBASE_LOCAL_EMULATOR_ORIGIN: "http://127.0.0.1:9199" }]) assert.equal(firebaseConfiguration({ ...environment, ...patch }), null);
  for (const url of ["https://evil.example/", "https://www.birkoru.com/", "http://127.0.0.1:9999/", "invalid"]) assert.equal(firebaseConfiguration(environment, url), null);
  const canary = { ...environment, STAGING_ENVIRONMENT: "true", AUTH_PUBLIC_ORIGIN: "https://koru-auth-canary.mustafayapayzeka.workers.dev" };
  assert.ok(firebaseConfiguration(canary)); assert.equal(firebaseConfiguration({ ...canary, STAGING_ENVIRONMENT: "false" }), null);
});

test("signed production identity checks uncached provider UID, verification and revocation on every authorization", async () => {
  const f = await fixture(); let calls = 0;
  const client = firebaseClient({ projectId: FIREBASE_PROJECT, apiKey: environment.FIREBASE_API_KEY }, { keys, request: async (input, options) => {
    calls++; const url = new URL(input);
    assert.equal(url.origin, "https://identitytoolkit.googleapis.com"); assert.equal(url.pathname, "/v1/accounts:lookup");
    assert.equal(options.method, "POST"); assert.equal(options.redirect, "manual"); assert.equal(options.cache, "no-store"); assert.equal(options.credentials, "omit");
    assert.equal(JSON.parse(options.body).idToken, f.tokens.idToken); return Response.json({ users: [f.user] });
  } });
  for (let i = 0; i < 2; i++) assert.equal((await client.identity(f.tokens)).uid, f.tokens.uid);
  assert.equal(calls, 2);
});

test("wrong issuer/project/provider, anonymous/unverified/tenant identities and malformed times fail before provider lookup", async () => {
  const client = firebaseClient({ projectId: FIREBASE_PROJECT, apiKey: environment.FIREBASE_API_KEY }, { keys, request: () => assert.fail("No provider lookup for an invalid signature/claim") });
  const now = Math.floor(Date.now() / 1000);
  for (const patch of [{ iss: "https://securetoken.google.com/koru-auth-test" }, { aud: "koru-auth-test" }, { aud: [FIREBASE_PROJECT, "foreign"] }, { exp: now - 1 },
    { iat: now + 10 }, { auth_time: now + 10 }, { auth_time: -1 }, { email: null }, { email_verified: false },
    { firebase: { sign_in_provider: "custom" } }, { firebase: { sign_in_provider: "password", tenant: "foreign" } }]) {
    const f = await fixture(patch); await assert.rejects(client.identity(f.tokens), (error) => error.code === "INVALID_IDENTITY");
  }
  const f = await fixture();
  for (const idToken of ["", "x".repeat(17000), "eyJhbGciOiJub25lIn0.e30.", f.tokens.idToken.slice(0, -20) + "a".repeat(20)])
    await assert.rejects(client.identity({ ...f.tokens, idToken }), (error) => error.code === "INVALID_IDENTITY");
  await assert.rejects(client.identity((await fixture({}, { kid: "foreign-key" })).tokens), (error) => error.code === "INVALID_IDENTITY");
});

test("valid signatures never bypass disabled/deleted/changed/revoked or malformed current provider state", async () => {
  const f = await fixture(); let user = f.user;
  const client = firebaseClient({ projectId: FIREBASE_PROJECT, apiKey: environment.FIREBASE_API_KEY }, { keys, request: async () => Response.json({ users: user ? [user] : [] }) });
  for (const patch of [{ localId: "foreign" }, { email: "foreign@example.test" }, { disabled: true }, { disabled: "false" }, { emailVerified: false },
    { validSince: String(f.payload.auth_time + 1) }, { validSince: "001" }, { validSince: "9007199254740993" }, { tenantId: "unexpected" }]) {
    user = { ...f.user, ...patch }; await assert.rejects(client.identity(f.tokens), (error) => error.code === "INVALID_IDENTITY");
  }
  user = null; await assert.rejects(client.identity(f.tokens), (error) => error.code === "INVALID_IDENTITY");
});

test("unverified tokens can only be inspected explicitly for pending signup, never accepted as a verified session", async () => {
  const f = await fixture({ email_verified: false });
  const client = firebaseClient({ projectId: FIREBASE_PROJECT, apiKey: environment.FIREBASE_API_KEY }, { keys, request: async () => Response.json({ users: [{ ...f.user, emailVerified: false }] }) });
  assert.equal((await client.identity(f.tokens, false)).verified, false);
  await assert.rejects(client.identity(f.tokens), (error) => error.code === "INVALID_IDENTITY");
});

test("fixed Firebase API transport retains Turkish locale, token form encoding and bounded/redacted failure semantics", async () => {
  let requestBody, requestUrl;
  const client = firebaseClient({ projectId: FIREBASE_PROJECT, apiKey: environment.FIREBASE_API_KEY }, { request: async (url, options) => {
    requestUrl = url; requestBody = options.body; assert.equal(options.headers["X-Firebase-Locale"], "tr"); return Response.json({ ok: true });
  } });
  await client.api("token", { grant_type: "refresh_token", refresh_token: "synthetic&token+" });
  assert.equal(new URL(requestUrl).origin, "https://securetoken.googleapis.com"); assert.equal(new URLSearchParams(requestBody).get("refresh_token"), "synthetic&token+");
  await assert.rejects(client.api("oobCodes", {}), (error) => error.code === "INVALID_OPERATION");
  for (const request of [async () => { throw Error("private-url-and-token"); }, async () => new Response("private", { status: 503 }), async () => new Response("private", { status: 429 }),
    async () => new Response("private", { status: 302 }), async () => new Response("private", { headers: { "Content-Type": "text/html" } }),
    async () => Response.json({ large: "x".repeat(33000) }), async () => Response.json({ error: { message: "INVALID_PASSWORD : private-details" } }, { status: 400 })]) {
    const isolated = firebaseClient({ projectId: FIREBASE_PROJECT, apiKey: environment.FIREBASE_API_KEY }, { request });
    await assert.rejects(isolated.api("signInWithPassword", {}), (error) => { assert.doesNotMatch(error.message, /private/); assert.ok(error.code); return true; });
  }
});

test("token parsing bounds identities and cannot accept missing credentials", () => {
  const tokens = { uid: "synthetic", idToken: "synthetic-token", refreshToken: "synthetic-refresh" };
  assert.deepEqual(firebaseTokens(tokens), tokens);
  assert.deepEqual(firebaseTokens({ localId: tokens.uid, idToken: tokens.idToken, refreshToken: tokens.refreshToken }), tokens);
  for (const patch of [{ uid: "" }, { uid: "a".repeat(129) }, { idToken: "" }, { idToken: "a".repeat(16385) }, { refreshToken: "" }, { refreshToken: "a".repeat(8193) }])
    assert.throws(() => firebaseTokens({ ...tokens, ...patch }));
});

test("email action codes remain bounded opaque provider values rather than a guessed base64 alphabet", () => {
  assert.equal(validFirebaseActionCode("synthetic-code.with+padding="), true);
  for (const value of [null, "", "short", "a".repeat(2049), "synthetic\ncode", "synthetic code", "synthetic\x00code"]) assert.equal(validFirebaseActionCode(value), false);
});
