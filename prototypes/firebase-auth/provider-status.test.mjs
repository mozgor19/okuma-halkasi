import assert from "node:assert/strict";
import { before, test } from "node:test";
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT } from "jose";
import { DEMO_PROJECT } from "./identity-contract.mjs";
import { providerCheckedVerifier } from "./provider-status.mjs";

const apiKey = "synthetic-api-key-for-local-tests";
const now = Math.floor(Date.now() / 1000);
let privateKey, keySet;
before(async () => {
  const pair = await generateKeyPair("RS256");
  privateKey = pair.privateKey;
  keySet = createLocalJWKSet({ keys: [{ ...await exportJWK(pair.publicKey), kid: "local-provider-key", alg: "RS256" }] });
});
function claims(overrides = {}) {
  return { sub: "synthetic-uid", iss: `https://securetoken.google.com/${DEMO_PROJECT}`, aud: DEMO_PROJECT,
    auth_time: now - 10, iat: now - 5, exp: now + 3600, email_verified: true, firebase: { sign_in_provider: "password" }, ...overrides };
}
const token = (overrides) => new SignJWT(claims(overrides)).setProtectedHeader({ alg: "RS256", kid: "local-provider-key" }).sign(privateKey);
const account = (overrides = {}) => ({ localId: "synthetic-uid", emailVerified: true, validSince: String(now - 20), ...overrides });
const response = (user = account()) => Response.json({ users: [user] });
const verifier = (request) => providerCheckedVerifier({ projectId: DEMO_PROJECT, apiKey, keySet, request });

test("signed verified identity also requires a fresh provider lookup, with no cookie/redirect/cache/token-in-URL", async () => {
  const value = await token();
  let calls = 0;
  const verify = verifier(async (url, options) => {
    calls++;
    const endpoint = new URL(url);
    assert.equal(endpoint.origin, "https://identitytoolkit.googleapis.com");
    assert.equal(endpoint.pathname, "/v1/accounts:lookup");
    assert.deepEqual([...endpoint.searchParams.keys()], ["key"]);
    assert.ok(!url.includes(value));
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    assert.equal(options.cache, "no-store");
    assert.equal(options.credentials, "omit");
    assert.ok(options.signal instanceof AbortSignal);
    assert.deepEqual(JSON.parse(options.body), { idToken: value });
    return response();
  });
  for (let i = 0; i < 2; i++) assert.deepEqual(await verify(value), { uid: "synthetic-uid", authTime: now - 10 });
  assert.equal(calls, 2, "A previous successful lookup must not authorize a later request");
});
test("wrong project, expired or unverified token is rejected before any provider request", async () => {
  let calls = 0;
  const verify = verifier(async () => { calls++; return response(); });
  for (const patch of [{ aud: "wrong-project" }, { email_verified: false }, { exp: now - 1 }]) await assert.rejects(verify(await token(patch)), /AUTH_IDENTITY_UNAVAILABLE/);
  await assert.rejects(verify("unsigned-emulator-token"), /AUTH_IDENTITY_UNAVAILABLE/);
  assert.equal(calls, 0);
});
test("deleted, disabled, revoked, unverified, wrong UID and tenant accounts cannot obtain an identity", async () => {
  const value = await token();
  for (const patch of [{ disabled: true }, { disabled: "false" }, { emailVerified: false }, { emailVerified: undefined },
    { localId: "another-account" }, { tenantId: "tenant" }, { validSince: String(now - 9) }])
    await assert.rejects(verifier(async () => response(account(patch)))(value), /AUTH_IDENTITY_UNAVAILABLE/);
  for (const data of [{}, { users: [] }, { users: [account(), account()] }, { users: [null] }])
    await assert.rejects(verifier(async () => Response.json(data))(value), /AUTH_IDENTITY_UNAVAILABLE/);
});
test("revocation compares original authentication time, not the later token refresh/issue time", async () => {
  const value = await token({ auth_time: now - 1000, iat: now - 1 });
  await assert.rejects(verifier(async () => response(account({ validSince: String(now - 500) })))(value), /AUTH_IDENTITY_UNAVAILABLE/);
  assert.deepEqual(await verifier(async () => response(account({ validSince: String(now - 1000) })))(value), { uid: "synthetic-uid", authTime: now - 1000 });
});
test("missing or malformed revocation data fails closed instead of assuming no revocations", async () => {
  const value = await token();
  for (const validSince of [undefined, null, 0, "-1", "01", "1e3", "NaN", "9007199254740993", "", String(now + 1000)])
    await assert.rejects(verifier(async () => response(account({ validSince })))(value), /AUTH_IDENTITY_UNAVAILABLE/);
});
test("provider outage, abuse/quota rejection, invalid JSON, redirects and unexpected MIME fail closed without sensitive diagnostics", async () => {
  const value = await token();
  const factories = [
    () => { throw Error("Private provider URL " + value); },
    () => { throw new DOMException("Private timeout diagnostic", "TimeoutError"); },
    ...[400, 401, 403, 429, 500, 503].map((status) => () => Response.json({ error: { message: "Private synthetic email" } }, { status })),
    () => new Response("Invalid private JSON", { headers: { "Content-Type": "application/json" } }),
    () => new Response("Private HTML", { headers: { "Content-Type": "text/html" } }),
    () => new Response(null, { status: 302, headers: { location: "https://evil.invalid" } }),
  ];
  for (const factory of factories) await assert.rejects(verifier(async () => factory())(value), (error) => {
    assert.equal(error.message, "AUTH_IDENTITY_UNAVAILABLE");
    assert.equal(error.cause, undefined);
    assert.ok(!String(error.stack).includes(value));
    return true;
  });
});
test("provider body size is bounded even without or with a dishonest Content-Length header", async () => {
  const value = await token();
  for (const length of [undefined, "1", "40000", "invalid"]) {
    const headers = { "Content-Type": "application/json", ...(length === undefined ? {} : { "Content-Length": length }) };
    await assert.rejects(verifier(async () => new Response(" ".repeat(40000), { headers }))(value), /AUTH_IDENTITY_UNAVAILABLE/);
  }
});
test("unknown provider profile fields, email matches and custom admin claims are not returned as Koru authority", async () => {
  const value = await token({ admin: true, email: "synthetic@example.invalid" });
  const result = await verifier(async () => response(account({ email: "synthetic@example.invalid", displayName: "Synthetic User", customAttributes: '{"admin":true}', role: "super_admin" })))(value);
  assert.deepEqual(Object.keys(result).sort(), ["authTime", "uid"]);
});
test("constructor rejects unsafe configuration without allowing caller-selected provider endpoints", () => {
  for (const apiKey of [undefined, "short", "https://evil.invalid", "key?redirect=https://evil.invalid", "x".repeat(201)])
    assert.throws(() => providerCheckedVerifier({ projectId: DEMO_PROJECT, apiKey, keySet }), /AUTH_PROVIDER_CONFIG/);
  assert.throws(() => providerCheckedVerifier({ projectId: "1038145971577", apiKey, keySet }), /INVALID_PROJECT/);
});
