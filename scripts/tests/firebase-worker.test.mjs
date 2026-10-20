import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { canonicalMigrations, legacyMigrations } from "../production-migration-policy.mjs";

const require = createRequire(import.meta.url), toolchain = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare } = toolchain("miniflare"), { build } = toolchain("esbuild");
const { outputFiles } = await build({
  stdin: { resolveDir: process.cwd(), sourcefile: "firebase-worker-test.ts", contents: `
    import * as accounts from "./db/firebase-accounts.ts";
    import { POST as operator } from "./app/api/operations/erasure/route.ts";
    import { drain } from "next/server";
    export default { async fetch(request) {
      try {
        const { action, args = [] } = await request.json();
        const allowed = { register: () => accounts.registerFirebaseAccount(request, args[0]),
          login: () => accounts.authenticateFirebaseAccount(...args),
          session: () => accounts.createFirebaseSession(...args),
          identity: () => accounts.firebaseSessionIdentity(...args),
          change: () => accounts.changeFirebasePassword(...args),
          revoke: () => accounts.revokeFirebaseSession(...args), flush: drain,
          operator: () => operator(new Request("https://birkoru.com/api/operations/erasure", { method: "POST",
            headers: { "Content-Type": "application/json", Authorization: "Bearer " + "a".repeat(64), ...args[1] }, body: JSON.stringify(args[0]) })) };
        if (!Object.hasOwn(allowed, action)) return new Response(null, { status: 404 });
        const result = await allowed[action]();
        return result instanceof Response ? result : Response.json(result ?? null);
      } catch (error) { return Response.json({ code: error.code || "TEST_FAILURE" }, { status: error.status || 500 }); }
    } };` },
  bundle: true, write: false, format: "esm", platform: "browser", target: "es2022",
  external: ["cloudflare:workers", "node:*"],
  plugins: [{ name: "test-only-after", setup(builder) {
    builder.onResolve({ filter: /^next\/server$/ }, () => ({ path: "after", namespace: "test-only" }));
    builder.onLoad({ filter: /.*/, namespace: "test-only" }, () => ({ contents:
      "const tasks=[]; export const after=(task)=>tasks.push(task); export async function drain(){while(tasks.length)await tasks.shift()();return {ok:true};}" }));
  } }],
});

async function fixture() {
  const keys = await generateKeyPair("RS256"), publicKey = await exportJWK(keys.publicKey);
  publicKey.kid = "synthetic-worker-key"; publicKey.alg = "RS256";
  const users = new Map(), messages = [], visited = [], hooks = { unavailable: false, wrongAudience: false, redirectApi: false, redirectKeys: false, providerDeleteFails: false };
  let clock = Math.floor(Date.now() / 1000) - 120;
  async function tokens(user) {
    const idToken = await new SignJWT({ email: user.email, email_verified: user.verified,
      auth_time: clock, firebase: { sign_in_provider: "password" } })
      .setProtectedHeader({ alg: "RS256", kid: publicKey.kid }).setSubject(user.uid)
      .setAudience(hooks.wrongAudience ? "koru-auth-test" : "koru-951bf")
      .setIssuer("https://securetoken.google.com/koru-951bf").setIssuedAt().setExpirationTime("1h").sign(keys.privateKey);
    return { localId: user.uid, idToken, refreshToken: "synthetic-refresh-" + user.uid };
  }
  function fromToken(value) {
    const uid = JSON.parse(Buffer.from(value.split(".")[1], "base64url")).sub;
    return [...users.values()].find((user) => user.uid === uid);
  }
  const worker = new Miniflare({ modules: true, script: outputFiles[0].text, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"], bindings: { AUTH_PROVIDER: "firebase", FIREBASE_PROJECT_ID: "koru-951bf", FIREBASE_API_KEY: "AIza" + "x".repeat(35),
      AUTH_PUBLIC_ORIGIN: "https://birkoru.com", APPLICATION_BRAND: "Koru", SESSION_SECRET: "Synthetic-local-worker-key-longer-than-32",
      SELF_SERVICE_ENABLED: "true", SELF_SERVICE_LOCAL: "false", READING_GROUPS_ENABLED: "true", STAGING_ENVIRONMENT: "false",
      MAINTENANCE_MODE: "true", ERASURE_OPERATOR_SECRET: "a".repeat(64) },
    async outboundService(request) {
      const url = new URL(request.url); visited.push(url.hostname + url.pathname);
      if (hooks.unavailable) return Response.json({}, { status: 503 });
      if (url.href === "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com") {
        if (hooks.redirectKeys) return new Response(null, { status: 302, headers: { Location: "https://never-follow.example.test/private" } });
        assert.equal(request.method, "GET"); return Response.json({ keys: [publicKey] });
      }
      assert.equal(url.origin, "https://identitytoolkit.googleapis.com", "No outbound request may reach a real provider");
      if (url.pathname.startsWith("/v1/projects/")) {
        assert.match(url.pathname, /^\/v1\/projects\/koru-951bf\/accounts:(lookup|delete)$/);
        assert.equal(request.headers.get("Authorization"), "Bearer synthetic-google-admin-access-token");
        const body = await request.json(), uid = Array.isArray(body.localId) ? body.localId[0] : body.localId;
        const user = [...users.values()].find((user) => user.uid === uid);
        if (url.pathname.endsWith(":lookup")) {
          assert.equal(url.searchParams.get("fields"), "users(localId,tenantId)");
          return Response.json(user ? { users: [{ localId: user.uid }] } : {});
        }
        if (hooks.providerDeleteFails) return Response.json({}, { status: 503 });
        if (user) users.delete(user.email);
        return Response.json({});
      }
      assert.equal(url.searchParams.get("key"), "AIza" + "x".repeat(35));
      assert.equal(request.method, "POST"); assert.equal(request.headers.get("X-Firebase-Locale"), "tr");
      if (hooks.redirectApi) return new Response(null, { status: 307, headers: { Location: "https://never-follow.example.test/private" } });
      const body = await request.json(), operation = url.pathname.split(":")[1];
      const user = body.email ? users.get(body.email) : body.idToken ? fromToken(body.idToken) : null;
      const rejected = (message) => Response.json({ error: { message } }, { status: 400 });
      if (operation === "signUp") {
        if (user) return rejected("EMAIL_EXISTS");
        const value = { uid: "synthetic-worker-user", email: body.email, password: body.password, verified: false, validSince: clock, disabled: false };
        users.set(value.email, value); return Response.json(await tokens(value));
      }
      if (operation === "signInWithPassword") return !user || user.disabled || user.password !== body.password
        ? rejected("INVALID_LOGIN_CREDENTIALS") : Response.json(await tokens(user));
      if (operation === "lookup") return Response.json({ users: user ? [{ localId: user.uid, email: user.email, emailVerified: user.verified,
        disabled: user.disabled, validSince: String(user.validSince) }] : [] });
      if (operation === "sendOobCode") { messages.push(body.requestType); return Response.json({ email: user?.email }); }
      if (operation === "update" && body.password && user) {
        user.password = body.password; user.validSince = ++clock;
        return Response.json(await tokens(user));
      }
      throw Error("Unexpected synthetic provider operation");
    },
  });
  const db = await worker.getD1Database("DB");
  for (const file of [...legacyMigrations, ...canonicalMigrations]) {
    const sql = readFileSync(new URL(`../../drizzle/${file}.sql`, import.meta.url), "utf8");
    for (const statement of sql.split("--> statement-breakpoint").filter((part) => part.trim())) await db.prepare(statement.trim()).run();
  }
  async function call(action, ...args) {
    const response = await worker.dispatchFetch("https://birkoru.com/api/synthetic-test", { method: "POST",
      headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, args }) });
    return { status: response.status, body: await response.json() };
  }
  return { worker, db, users, messages, visited, hooks, call };
}

test("production Firebase accounts execute with actual workerd D1, RS256/JWKS and encrypted sessions using synthetic transport only", async () => {
  const f = await fixture(), password = "Synthetic-Worker-Password-5829";
  try {
    const registered = await f.call("register", { email: "worker@example.test", username: "worker.reader", name: "Synthetic Reader", password, acceptedPolicy: true });
    assert.equal(registered.status, 200); assert.equal(registered.body.ok, true); assert.equal(f.visited.length, 0);
    await f.call("flush");
    assert.equal(f.users.size, 1, JSON.stringify({ visited: f.visited, pending: (await f.db.prepare("SELECT count(*) AS n FROM firebase_registrations").first()).n }));
    assert.deepEqual(f.messages, ["VERIFY_EMAIL"]);
    assert.equal((await f.call("login", "worker.reader", password)).body, null);
    const user = f.users.get("worker@example.test"); user.verified = true;
    const signed = (await f.call("login", "worker.reader", password)).body; assert.ok(signed?.memberId);
    const handle = (await f.call("session", signed.memberId, signed.sessionVersion, signed.firebase)).body;
    assert.match(handle, /^fb2\.[a-f0-9]{64}$/);
    assert.deepEqual((await f.call("identity", handle)).body, { memberId: signed.memberId, sessionVersion: signed.sessionVersion, firebase: true });
    const stored = await f.db.prepare("SELECT sealed_credentials FROM firebase_sessions").first();
    assert.doesNotMatch(stored.sealed_credentials, /synthetic-refresh|worker@example|eyJ/);
    const changed = await f.call("change", signed.memberId, password, "Next-Synthetic-Worker-Password-7834");
    assert.equal(changed.body.ok, true); assert.equal(changed.body.sessionVersion, 2);
    assert.equal((await f.call("identity", handle)).body, null);
    assert.equal((await f.call("login", "worker.reader", password)).body, null);
    assert.ok((await f.call("login", "worker.reader", "Next-Synthetic-Worker-Password-7834")).body?.memberId);
    assert.deepEqual((await f.db.prepare("PRAGMA foreign_key_check").all()).results, []);
    assert.equal((await f.db.prepare("SELECT count(*) AS n FROM reading_group_memberships").first()).n, 0);
    assert.ok(f.visited.some((url) => url.startsWith("www.googleapis.com/")));
  } finally { await f.worker.dispose(); }
});

test("Worker authorization rejects a different project, disabled/deleted identities and provider outages without legacy fallback", async () => {
  const f = await fixture(), password = "Synthetic-Worker-Password-5829";
  try {
    await f.call("register", { email: "worker@example.test", username: "worker.reader", name: "Synthetic Reader", password, acceptedPolicy: true });
    await f.call("flush"); const user = f.users.get("worker@example.test"); user.verified = true;
    f.hooks.wrongAudience = true; assert.equal((await f.call("login", "worker.reader", password)).body, null);
    assert.equal((await f.db.prepare("SELECT count(*) AS n FROM member_accounts").first()).n, 0);
    f.hooks.wrongAudience = false;
    const signed = (await f.call("login", "worker.reader", password)).body;
    const handle = (await f.call("session", signed.memberId, signed.sessionVersion, signed.firebase)).body;
    user.disabled = true; assert.equal((await f.call("identity", handle)).body, null);
    user.disabled = false; f.hooks.unavailable = true;
    const unavailable = await f.call("identity", handle); assert.equal(unavailable.status, 503); assert.equal(unavailable.body.code, "IDENTITY_UNAVAILABLE");
    f.hooks.unavailable = false; f.users.clear(); assert.equal((await f.call("identity", handle)).body, null);
  } finally { await f.worker.dispose(); }
});

test("Worker Firebase API and signing-key redirects never forward credentials or follow foreign URLs", async () => {
  for (const keys of [false, true]) {
    const f = await fixture(), password = "Synthetic-Worker-Password-5829";
    try {
      f.hooks.redirectKeys = keys;
      await f.call("register", { email: "worker@example.test", username: "worker.reader", name: "Synthetic Reader", password, acceptedPolicy: true });
      await f.call("flush"); f.users.get("worker@example.test").verified = true;
      f.hooks.redirectApi = !keys;
      const result = await f.call("login", "worker.reader", password);
      assert.equal(result.status, 503); assert.equal(result.body.code, "IDENTITY_UNAVAILABLE");
      assert.equal(f.visited.some((url) => url.includes("never-follow")), false);
      assert.equal((await f.db.prepare("SELECT count(*) AS n FROM member_accounts").first()).n, 0);
    } finally { await f.worker.dispose(); }
  }
});

test("protected operator endpoint executes coordinated provider and real D1 erasure; provider failure preserves data and resumes safely", async () => {
  const f = await fixture(), password = "Synthetic-Worker-Password-5829", requestId = "11111111-1111-4111-8111-111111111111";
  try {
    const anonymous = await f.call("operator", { action: "queue" }, { Authorization: "" }); assert.equal(anonymous.status, 404);
    await f.call("register", { email: "worker@example.test", username: "worker.reader", name: "Synthetic Reader", password, acceptedPolicy: true });
    await f.call("flush"); f.users.get("worker@example.test").verified = true;
    const signed = (await f.call("login", "worker.reader", password)).body;
    const handle = (await f.call("session", signed.memberId, signed.sessionVersion, signed.firebase)).body;
    await f.db.prepare("INSERT INTO account_deletion_requests(id,member_id,requested_at,updated_at) VALUES(?,?,1,1)").bind(requestId, signed.memberId).run();
    const inspected = await f.call("operator", { action: "inspect", requestId }); assert.equal(inspected.status, 200);
    assert.equal(inspected.body.plan.identity.count, 1); assert.deepEqual(inspected.body.plan.blockers, []);
    const command = { action: "execute", requestId, expectedDigest: inspected.body.digest, confirmation: inspected.body.plan.confirmation,
      writersStopped: true, contentReviewComplete: true, providerAccessToken: "synthetic-google-admin-access-token" };
    f.hooks.providerDeleteFails = true;
    assert.equal((await f.call("operator", command)).body.phase, "frozen");
    assert.equal((await f.call("operator", command)).status, 503);
    assert.equal((await f.call("identity", handle)).body, null);
    assert.equal((await f.db.prepare("SELECT count(*) AS n FROM member_accounts").first()).n, 1);
    assert.equal((await f.db.prepare("SELECT name FROM members WHERE id=?").bind(signed.memberId).first()).name, "Synthetic Reader");
    f.hooks.providerDeleteFails = false;
    const finished = await f.call("operator", command); assert.equal(finished.status, 200); assert.equal(finished.body.completed, true);
    assert.equal(f.users.size, 0);
    assert.equal((await f.db.prepare("SELECT count(*) AS n FROM member_accounts").first()).n, 0);
    assert.equal((await f.db.prepare("SELECT count(*) AS n FROM firebase_sessions").first()).n, 0);
    assert.ok((await f.db.prepare("SELECT deleted_at FROM account_erasure_provider_checkpoints").first()).deleted_at);
    assert.deepEqual((await f.db.prepare("PRAGMA foreign_key_check").all()).results, []);
    assert.equal((await f.call("operator", command)).body.alreadyCompleted, true);
  } finally { await f.worker.dispose(); }
});
