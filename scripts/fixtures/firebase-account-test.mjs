import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { pbkdf2Sync } from "node:crypto";
import { legacyMigrations, canonicalMigrations } from "../production-migration-policy.mjs";

const require = createRequire(import.meta.url), ts = require("typescript");
export const oldPassword = "Old-Synthetic-Password-8197", newPassword = "Second-Synthetic-Password-9326";

// Unit-only provider double. Real RS256/protocol acceptance is tested separately.
export function firebaseAccountFixture() {
  const sql = new DatabaseSync(":memory:"); sql.exec("PRAGMA foreign_keys=ON");
  for (const name of [...legacyMigrations, ...canonicalMigrations]) sql.exec(readFileSync(new URL(`../../drizzle/${name}.sql`, import.meta.url), "utf8"));
  const hooks = { failBatch: false, failAfterPassword: false, failAfterSignup: false, unavailable: false };
  const db = { prepare(statement) {
    let values = [];
    return { statement, get values() { return values; }, bind(...args) { values = args; return this; },
      async first() { return sql.prepare(statement).get(...values) ?? null; },
      async all() { return { results: sql.prepare(statement).all(...values) }; },
      async run() { const result = sql.prepare(statement).run(...values); return { meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; } };
  }, async batch(statements) {
    if (hooks.failBatch) throw Error("Synthetic D1 failure");
    sql.exec("BEGIN IMMEDIATE");
    try {
      const results = statements.map((statement) => { const result = sql.prepare(statement.statement).run(...statement.values); return { results: [], meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) } }; });
      sql.exec("COMMIT"); return results;
    } catch (error) { sql.exec("ROLLBACK"); throw error; }
  } };
  const env = { DB: db, AUTH_PROVIDER: "firebase", FIREBASE_PROJECT_ID: "koru-951bf", FIREBASE_API_KEY: "AIza" + "x".repeat(35),
    AUTH_PUBLIC_ORIGIN: "https://birkoru.com", SESSION_SECRET: "Synthetic-server-session-key-longer-than-32",
    SELF_SERVICE_ENABLED: "true", READING_GROUPS_ENABLED: "true", SELF_SERVICE_LOCAL: "false", APPLICATION_BRAND: "Koru" };
  const modules = new Map(), users = new Map(), grants = new Map(), messages = [], calls = [], tasks = [], diagnostics = [];
  let clock = Math.floor(Date.now() / 1000) - 200, serial = 0;
  function load(name) {
    if (modules.has(name)) return modules.get(name).exports;
    const compiledModule = { exports: {} }; modules.set(name, compiledModule);
    const source = ts.transpileModule(readFileSync(new URL(`../../${name}.ts`, import.meta.url), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", "console", source)((key) => {
      if (key === "cloudflare:workers") return { env };
      if (key === "next/server") return { ...require("next/server"), after: (task) => tasks.push(task) };
      if (key === "@/lib/firebase-auth") return { ...load("lib/firebase-auth"), remoteFirebase: () => provider };
      return key.startsWith("@/") ? load(key.slice(2)) : require(key);
    }, compiledModule, compiledModule.exports, { ...console, error: (...args) => diagnostics.push(args) });
    return compiledModule.exports;
  }
  const error = (code) => new (load("lib/firebase-protocol").FirebaseError)(code);
  function user(email, password = newPassword, verified = true) {
    const result = { uid: "synthetic-uid-" + ++serial, email, password, verified, disabled: false, validSince: clock };
    users.set(email, result); return result;
  }
  function tokens(value, authTime = clock) {
    const refreshToken = "synthetic-refresh-" + ++serial;
    const payload = { sub: value.uid, exp: Math.floor(Date.now() / 1000) + 3600, auth_time: authTime };
    const idToken = [Buffer.from('{"alg":"RS256","kid":"unit-double-only"}').toString("base64url"), Buffer.from(JSON.stringify(payload)).toString("base64url"), "unit-double-signature"].join(".");
    grants.set(refreshToken, { uid: value.uid, authTime });
    return { uid: value.uid, idToken, refreshToken };
  }
  const output = (value) => ({ localId: value.uid, idToken: value.idToken, refreshToken: value.refreshToken });
  const provider = {
    async api(operation, body) {
      calls.push(operation); if (hooks.unavailable) throw error("UNAVAILABLE");
      if (operation === "signUp") {
        if (users.has(body.email)) throw error("EMAIL_EXISTS");
        const value = user(body.email, body.password, false), result = output(tokens(value));
        if (hooks.failAfterSignup) throw error("UNAVAILABLE"); return result;
      }
      if (operation === "signInWithPassword") {
        const value = users.get(body.email);
        if (!value || value.password !== body.password || value.disabled) throw error("INVALID_LOGIN_CREDENTIALS");
        return output(tokens(value));
      }
      if (operation === "sendOobCode") {
        const value = body.email ? users.get(body.email) : [...users.values()].find((u) => u.uid === JSON.parse(Buffer.from(body.idToken.split(".")[1], "base64url")).sub);
        if (!value) throw error("EMAIL_NOT_FOUND");
        const code = "synthetic-code-" + ++serial;
        messages.push({ code, uid: value.uid, email: value.email, kind: body.requestType, continueUrl: body.continueUrl, consumed: false });
        return { email: value.email };
      }
      if (operation === "update" && body.oobCode) {
        const message = messages.find((m) => m.code === body.oobCode && m.kind === "VERIFY_EMAIL" && !m.consumed);
        if (!message) throw error("INVALID_OOB_CODE"); message.consumed = true;
        const value = users.get(message.email); value.verified = true;
        return { localId: value.uid, email: value.email };
      }
      if (operation === "resetPassword") {
        const message = messages.find((m) => m.code === body.oobCode && m.kind === "PASSWORD_RESET" && !m.consumed);
        if (!message) throw error("INVALID_OOB_CODE");
        const value = users.get(message.email);
        if (body.newPassword) { value.password = body.newPassword; value.validSince = ++clock; message.consumed = true; }
        return { email: value.email, requestType: "PASSWORD_RESET" };
      }
      if (operation === "update" && body.password) {
        const uid = JSON.parse(Buffer.from(body.idToken.split(".")[1], "base64url")).sub, value = [...users.values()].find((u) => u.uid === uid);
        value.password = body.password; value.validSince = ++clock;
        const result = output(tokens(value));
        if (hooks.failAfterPassword) throw error("UNAVAILABLE"); return result;
      }
      if (operation === "token") {
        const grant = grants.get(body.refresh_token), value = [...users.values()].find((u) => u.uid === grant?.uid);
        if (!value || value.disabled || grant.authTime < value.validSince) throw error("INVALID_REFRESH_TOKEN");
        const fresh = tokens(value, grant.authTime);
        return { user_id: fresh.uid, id_token: fresh.idToken, refresh_token: fresh.refreshToken, project_id: "605673770248" };
      }
      if (operation === "delete") {
        const uid = JSON.parse(Buffer.from(body.idToken.split(".")[1], "base64url")).sub, value = [...users.values()].find((u) => u.uid === uid);
        if (!value) throw error("USER_NOT_FOUND"); users.delete(value.email); return {};
      }
      throw Error("Unexpected unit provider operation");
    },
    async identity(value, verified = true) {
      if (hooks.unavailable) throw error("UNAVAILABLE");
      const claims = JSON.parse(Buffer.from(value.idToken.split(".")[1], "base64url")), stored = [...users.values()].find((u) => u.uid === value.uid);
      if (!stored || stored.disabled || claims.sub !== value.uid || claims.auth_time < stored.validSince || (verified && !stored.verified)) throw error("INVALID_IDENTITY");
      return { uid: stored.uid, email: stored.email, verified: stored.verified, authTime: claims.auth_time, validSince: stored.validSince, expires: claims.exp };
    },
  };
  function legacy(id = 1, username = "legacy.reader") {
    const salt = "b".repeat(32), hash = pbkdf2Sync(oldPassword, Buffer.from(salt, "hex"), 100000, 32, "sha256").toString("hex");
    sql.prepare("INSERT INTO members(id,name,role) VALUES(?,'Synthetic Legacy','super_admin')").run(id);
    sql.prepare("INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations) VALUES(?,?,?,?,100000)").run(id, username, hash, salt);
    sql.prepare("INSERT INTO reading_group_memberships(account_member_id,group_id,member_id,scheme,color_mode) VALUES(?,'default',?,'catalogue','dark')").run(id, id);
    return { id, username, hash };
  }
  const request = new Request("https://birkoru.com/api/onboarding/register", { method: "POST", headers: { Origin: "https://birkoru.com" } });
  const registration = (patch = {}) => ({ name: "Synthetic Reader", username: "new.reader", email: "new@example.test", password: newPassword, acceptedPolicy: true, ...patch });
  async function flush() { while (tasks.length) await tasks.shift()(); }
  return { env, sql, db, hooks, load, users, grants, messages, calls, provider, user, tokens, legacy, request, registration, tasks, diagnostics, flush,
    async register(patch = {}) {
      const body = registration(patch); await load("db/firebase-accounts").registerFirebaseAccount(request, body);
      await flush();
      return { body, user: users.get(body.email) };
    }, close() { sql.close(); } };
}
