import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url), ts = require("typescript");
function setup() {
  const env = { SESSION_SECRET: "Synthetic-local-session-secret-more-than-32", AUTH_PROVIDER: "firebase-local", SELF_SERVICE_LOCAL: "true",
    SELF_SERVICE_ENABLED: "true", READING_GROUPS_ENABLED: "true", AUTH_PUBLIC_ORIGIN: "http://127.0.0.1:5198", FIREBASE_LOCAL_EMULATOR_ORIGIN: "http://127.0.0.1:9198" };
  const modules = new Map();
  class ReadingGroupError extends Error { constructor(code, status, message) { super(message); this.code = code; this.status = status; } }
  function load(name) {
    if (modules.has(name)) return modules.get(name).exports;
    const compiledModule = { exports: {} }; modules.set(name, compiledModule);
    const source = ts.transpileModule(readFileSync(new URL(`../../${name}.ts`, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    new Function("require", "module", "exports", source)((key) => key === "cloudflare:workers" ? { env }
      : key === "@/lib/groups" ? { ReadingGroupError }
      : key.startsWith("@/") ? load(key.slice(2)) : require(key), compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  return { env, load };
}
test("Firebase mode is opt-in and requires every local guard, demo backend, and exact loopback request origin", () => {
  const { env, load } = setup(), policy = load("lib/firebase-local-policy");
  assert.equal(policy.firebaseLocalSelected({}), false);
  assert.ok(policy.firebaseLocalConfiguration(env, env.AUTH_PUBLIC_ORIGIN + "/api/auth/login"));
  for (const patch of [{ AUTH_PROVIDER: "firebase" }, { AUTH_PROVIDER: "" }, { SELF_SERVICE_LOCAL: "false" }, { SELF_SERVICE_ENABLED: "false" },
    { READING_GROUPS_ENABLED: "false" }, { SESSION_SECRET: "short" }, { AUTH_PUBLIC_ORIGIN: "https://birkoru.com" },
    { AUTH_PUBLIC_ORIGIN: "http://localhost:5198" }, { FIREBASE_LOCAL_EMULATOR_ORIGIN: "https://identitytoolkit.googleapis.com" },
    { FIREBASE_LOCAL_EMULATOR_ORIGIN: "http://127.0.0.1:9198/path" }, { FIREBASE_LOCAL_EMULATOR_ORIGIN: "http://127.0.0.1:9198#x" },
    { FIREBASE_LOCAL_EMULATOR_ORIGIN: env.AUTH_PUBLIC_ORIGIN }, { FIREBASE_LOCAL_EMULATOR_ORIGIN: "http://127.0.0.1:80" }])
    assert.equal(policy.firebaseLocalConfiguration({ ...env, ...patch }), null);
  for (const url of ["https://birkoru.com/api/auth/login", "http://127.0.0.1:5199/", "http://localhost:5198/", "invalid"])
    assert.equal(policy.firebaseLocalConfiguration(env, url), null);
  assert.equal(policy.syntheticFirebaseEmail("test@example.test"), true);
  assert.equal(policy.syntheticFirebaseEmail("test@example.invalid"), true);
  assert.equal(policy.syntheticFirebaseEmail("koru.destek@gmail.com"), false);
});
test("provider configuration errors happen before network, and cannot degrade to legacy password/session issuance", async () => {
  const { env, load } = setup(), client = load("lib/firebase-local"), auth = load("lib/auth");
  await assert.rejects(auth.createSessionToken(1, 1), /Provider identity required/);
  assert.equal(await auth.sessionIdentity("1:1:9999999999999.deadbeef"), null);
  env.FIREBASE_LOCAL_EMULATOR_ORIGIN = "https://evil.invalid";
  assert.match(auth.authConfigurationIssue(), /kullanılamıyor/);
  await assert.rejects(client.firebaseLocalApi("signUp", {}), (error) => error.code === "LOCAL_AUTH_UNAVAILABLE");
  env.AUTH_PROVIDER = undefined;
  assert.equal(auth.authConfigurationIssue(), null);
  assert.equal(await auth.sessionIdentity("fb1." + "a".repeat(64)), null);
});
test("provider credentials are sealed with random IV and reject tampering, wrong purpose/account/session or secret", async () => {
  const { env, load } = setup(), client = load("lib/firebase-local");
  const value = { uid: "synthetic-uid", idToken: "private-synthetic-token", refreshToken: "private-refresh" }, context = "session:synthetic-account-1:version-2";
  const first = await client.sealFirebaseLocal(value, context), second = await client.sealFirebaseLocal(value, context);
  assert.notEqual(first, second); assert.doesNotMatch(first, /private-|synthetic-uid/);
  assert.deepEqual(await client.openFirebaseLocal(first, context), value);
  for (const other of ["action:synthetic-account-1:version-2", "session:synthetic-account-2:version-2", "session:synthetic-account-1:version-3"])
    await assert.rejects(client.openFirebaseLocal(first, other));
  const changed = JSON.parse(first); changed.data = Buffer.alloc(64).toString("base64");
  await assert.rejects(client.openFirebaseLocal(JSON.stringify(changed), context));
  env.SESSION_SECRET = "Another-synthetic-secret-more-than-32-characters";
  await assert.rejects(client.openFirebaseLocal(first, context));
});
test("managed accounts never reuse a bootstrap password if the Firebase-local flag is turned off", async () => {
  const { env, load } = setup(); env.AUTH_PROVIDER = undefined;
  const database = load("db/database"), managed = load("lib/firebase-local-policy").FIREBASE_MANAGED_HASH;
  env.DB = { prepare(sql) { return { bind() { return this; }, async first() {
    if (sql.includes("sqlite_master")) return null;
    return { memberId: 1, username: "synthetic", passwordHash: managed, passwordIterations: 0, sessionVersion: 1 };
  } }; } };
  env.MEMBER_CREDENTIALS = JSON.stringify({ synthetic: { memberId: 1, password: "Old-Synthetic-Password-8426" } });
  assert.equal(database.identityDatabase(), env.DB);
  const accounts = load("db/accounts");
  assert.equal(await accounts.authenticateAccount("synthetic", "Old-Synthetic-Password-8426"), null);
  assert.equal(await accounts.sessionAccountIsCurrent({ memberId: 1, sessionVersion: 1 }), false);
  assert.equal((await accounts.changeMemberPassword(1, "Old-Synthetic-Password-8426", "New-Synthetic-Password-9826")).ok, false);
  env.DB = { async batch() { return []; }, prepare() { return { bind() { return this; }, async run() { return {}; }, async first() {
    return { memberId: 1, username: "synthetic", email: "synthetic@example.test", passwordHash: managed };
  } }; } };
  const onboarding = load("db/onboarding-accounts");
  assert.equal((await onboarding.requestRecovery(new Request("http://127.0.0.1:5198/"), "synthetic@example.test")).ok, true);
  await assert.rejects(onboarding.resetAccountPassword("a".repeat(64), "New-Synthetic-Password-9826"), (error) => error.code === "INVALID_TOKEN");
});

function identityFixture(patch = {}) {
  const now = Math.floor(Date.now() / 1000), uid = "synthetic-uid";
  const payload = { aud: "demo-koru-auth-local", iss: "https://securetoken.google.com/demo-koru-auth-local", sub: uid,
    exp: now + 3600, iat: now, auth_time: now - 60, email_verified: true, firebase: { sign_in_provider: "password" }, ...patch };
  const idToken = [Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"), Buffer.from(JSON.stringify(payload)).toString("base64url"), ""].join(".");
  return { payload, tokens: { uid, idToken, refreshToken: "synthetic-private-refresh" }, user: { localId: uid, email: "synthetic@example.test", emailVerified: true, validSince: String(now - 120) } };
}
test("local identity always checks current provider status and rejects revoked, disabled, deleted, tenant and malformed identities", async () => {
  const { load } = setup(), client = load("lib/firebase-local"), original = globalThis.fetch;
  const fixture = identityFixture(); let user = fixture.user, calls = 0;
  globalThis.fetch = async (url, init) => {
    calls++; assert.equal(new URL(url).origin, "http://127.0.0.1:9198");
    assert.equal(init.redirect, "manual");
    return Response.json({ users: user ? [user] : [] });
  };
  try {
    assert.equal((await client.firebaseLocalIdentity(fixture.tokens)).user.localId, fixture.tokens.uid);
    for (const patch of [{ disabled: true }, { disabled: "false" }, { emailVerified: false }, { localId: "another-uid" },
      { validSince: String(fixture.payload.auth_time + 1) }, { validSince: "01" }, { validSince: "9007199254740993" }, { tenantId: "unexpected" }]) {
      user = { ...fixture.user, ...patch };
      await assert.rejects(client.firebaseLocalIdentity(fixture.tokens), (error) => error.code === "INVALID_IDENTITY");
    }
    user = null; await assert.rejects(client.firebaseLocalIdentity(fixture.tokens));
    const before = calls;
    for (const patch of [{ aud: "koru-auth-test" }, { email_verified: false }, { exp: 1 }, { firebase: { sign_in_provider: "custom" } }])
      await assert.rejects(client.firebaseLocalIdentity(identityFixture(patch).tokens));
    assert.equal(calls, before);
    for (const status of [301, 302, 307, 308, 429, 500, 503]) {
      globalThis.fetch = async () => new Response("private-provider-diagnostics", { status });
      await assert.rejects(client.firebaseLocalIdentity(fixture.tokens), (error) => error.code === "IDENTITY_UNAVAILABLE" && !error.message.includes("private"));
    }
    globalThis.fetch = async () => { throw Error("private network error"); };
    await assert.rejects(client.firebaseLocalIdentity(fixture.tokens), (error) => error.status === 503 && error.cause === undefined);
  } finally { globalThis.fetch = original; }
});
test("expired credentials refresh with exact UID/project binding and cannot revive a concurrently revoked handle", async () => {
  const { env, load } = setup(), client = load("lib/firebase-local"), accounts = load("db/firebase-local-accounts"), original = globalThis.fetch;
  const expired = identityFixture({ exp: Math.floor(Date.now() / 1000) - 1 }), fresh = identityFixture();
  const token = "a".repeat(64), row = { tokenHash: await load("lib/onboarding-policy").tokenHash(token), memberId: 10, sessionVersion: 1,
    projectId: "demo-koru-auth-local", uid: fresh.tokens.uid, authTime: expired.payload.auth_time, expires: Date.now() + 60000 };
  const context = JSON.stringify(["session", row.tokenHash, row.memberId, row.sessionVersion, row.projectId, row.uid, row.authTime, row.expires]);
  row.sealed = await client.sealFirebaseLocal(expired.tokens, context);
  let returnedProject = "12345", returnedUid = row.uid, revoked = false, revokeDuringRefresh = false, refreshes = 0;
  env.DB = { prepare(sql) { let values; return { bind(...args) { values = args; return this; }, async first() {
    if (sql.includes("firebase_local_environment")) return { projectId: row.projectId };
    if (sql.includes("sqlite_master")) return null;
    if (sql.startsWith("SELECT 1")) return revoked ? null : { 1: 1 };
    return revoked ? null : { ...row };
  }, async run() { if (revoked) return { meta: { changes: 0 } }; row.sealed = values[0]; return { meta: { changes: 1 } }; } }; } };
  globalThis.fetch = async (url) => {
    if (new URL(url).pathname.endsWith("/token")) {
      refreshes++; if (revokeDuringRefresh) revoked = true;
      return Response.json({ project_id: returnedProject, user_id: returnedUid, id_token: fresh.tokens.idToken, refresh_token: fresh.tokens.refreshToken });
    }
    return Response.json({ users: [fresh.user] });
  };
  try {
    assert.deepEqual(await accounts.firebaseLocalSessionIdentity("fb1." + token), { memberId: 10, sessionVersion: 1, firebaseLocal: true });
    assert.equal(refreshes, 1);
    const validSeal = row.sealed;
    for (const mismatch of ["project", "uid", "revoked"]) {
      row.sealed = await client.sealFirebaseLocal(expired.tokens, context);
      returnedProject = mismatch === "project" ? "12346" : "12345";
      returnedUid = mismatch === "uid" ? "another-uid" : row.uid;
      revokeDuringRefresh = mismatch === "revoked";
      assert.equal(await accounts.firebaseLocalSessionIdentity("fb1." + token), null);
    }
    revoked = false; row.sealed = validSeal;
    globalThis.fetch = async () => new Response("", { status: 503 });
    await assert.rejects(accounts.firebaseLocalSessionIdentity("fb1." + token), (error) => error.status === 503);
  } finally { globalThis.fetch = original; }
});
test("ambiguous password mutation keeps a durable identity freeze instead of granting stale or freshly raced sessions", async () => {
  const { env, load } = setup(), accounts = load("db/firebase-local-accounts"), original = globalThis.fetch;
  const fixture = identityFixture(), link = { memberId: 10, username: "local.owner", email: fixture.user.email, uid: fixture.tokens.uid, projectId: "demo-koru-auth-local", sessionVersion: 1 };
  let frozen = false, failCommit = false;
  env.DB = { prepare(sql) { return { bind() { return this; }, async first() {
    if (sql.includes("firebase_local_environment")) return { projectId: link.projectId };
    if (sql.includes("sqlite_master") || sql.includes("FROM firebase_local_registrations")) return null;
    if (sql.startsWith("UPDATE firebase_local_links SET mutation_pending=1")) { assert.equal(frozen, false); frozen = true; return { member_id: 10 }; }
    if (sql.includes("mutation_pending=0")) return frozen ? null : link;
    throw Error("Unexpected fixture SQL");
  } }; }, async batch() { assert.equal(frozen, true); if (failCommit) throw Error("Synthetic D1 commit failure"); throw Error("Unexpected commit"); } };
  globalThis.fetch = async (url) => {
    const operation = new URL(url).pathname.split(":").at(-1);
    if (operation === "signInWithPassword") return Response.json({ localId: fixture.tokens.uid, idToken: fixture.tokens.idToken, refreshToken: fixture.tokens.refreshToken });
    if (operation === "lookup") return Response.json({ users: [fixture.user] });
    if (operation === "update") {
      assert.equal(frozen, true);
      return failCommit ? Response.json({ localId: fixture.tokens.uid, idToken: fixture.tokens.idToken, refreshToken: fixture.tokens.refreshToken }) : new Response("private-provider-outage", { status: 503 });
    }
    throw Error("Unexpected fixture network operation");
  };
  try {
    await assert.rejects(accounts.changeFirebaseLocalPassword(10, "Synthetic-Old-Password-8296", "Synthetic-New-Password-9826"), (error) => error.status === 503);
    assert.equal(frozen, true);
    assert.equal(await accounts.authenticateFirebaseLocal(link.username, "Synthetic-Old-Password-8296"), null);
    assert.equal(await accounts.firebaseLocalSessionIdentity("fb1." + "b".repeat(64)), null);
    frozen = false; failCommit = true;
    await assert.rejects(accounts.changeFirebaseLocalPassword(10, "Synthetic-Old-Password-8296", "Synthetic-New-Password-9826"), /Synthetic D1 commit failure/);
    assert.equal(frozen, true);
    assert.equal(await accounts.authenticateFirebaseLocal(link.username, "Synthetic-New-Password-9826"), null);
  } finally { globalThis.fetch = original; }
});
