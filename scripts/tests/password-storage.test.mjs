import assert from "node:assert/strict";
import test from "node:test";
import { pbkdf2Sync } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const password = "Synthetic-Sample-48296";
const salt = "0123456789abcdef0123456789abcdef";
const vector = (iterations, value = password) => pbkdf2Sync(value, Buffer.from(salt, "hex"), iterations, 32, "sha256").toString("hex");

function setup(iterations = "600000") {
  const sql = new DatabaseSync(":memory:");
  sql.exec("CREATE TABLE members(id integer PRIMARY KEY); INSERT INTO members VALUES(1)");
  sql.exec(readFileSync(new URL("../../drizzle/0002_member_accounts.sql", import.meta.url), "utf8"));
  let beforeRead = () => {};
  let beforeWrite = () => {};
  const env = { PASSWORD_HASH_ITERATIONS: iterations, SESSION_SECRET: "synthetic-secret-with-at-least-32-characters", MEMBER_CREDENTIALS: JSON.stringify({ reader: { memberId: 1, password } }) };
  env.DB = { prepare(statement) {
    let values = [];
    return {
      bind(...args) { values = args; return this; },
      async first() { beforeRead(statement); return sql.prepare(statement).get(...values) ?? null; },
      async run() { beforeWrite(statement); return sql.prepare(statement).run(...values); },
    };
  } };
  const cache = new Map();
  function load(name) {
    if (cache.has(name)) return cache.get(name).exports;
    const compiledModule = { exports: {} }; cache.set(name, compiledModule);
    const code = ts.transpileModule(readFileSync(new URL(`../../${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", code)((key) => key === "cloudflare:workers" ? { env } : key.startsWith("@/") ? load(key.slice(2)) : require(key), compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  return { sql, load, beforeRead: (fn) => { beforeRead = fn; }, beforeWrite: (fn) => { beforeWrite = fn; } };
}

test("new passwords use random salts and 600,000 standard PBKDF2-SHA256 iterations", async () => {
  const ctx = setup();
  try {
    const crypto = ctx.load("lib/password");
    const first = await crypto.hashPassword(password);
    const second = await crypto.hashPassword(password);
    assert.equal(first.iterations, 600_000);
    assert.notEqual(first.salt, second.salt);
    assert.equal(first.hash, pbkdf2Sync(password, Buffer.from(first.salt, "hex"), first.iterations, 32, "sha256").toString("hex"));
    assert.equal(await crypto.verifyPassword(password, first.hash, first.salt, first.iterations), true);
    assert.equal(await crypto.verifyPassword("Wrong-Password-4934", first.hash, first.salt, first.iterations), false);
  } finally { ctx.sql.close(); }
});

test("legacy runtime default never attempts an unverified stronger work factor", async () => {
  const legacy = setup("");
  try {
    // The public release policy separately blocks this legacy default.
    assert.equal((await legacy.load("lib/password").hashPassword(password)).iterations, 100_000);
    legacy.sql.prepare("INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations) VALUES(1,'reader',?,?,100000)").run(vector(100_000), salt);
    assert.deepEqual(await legacy.load("db/accounts").authenticateAccount("reader", password), { memberId: 1, sessionVersion: 1 });
    assert.equal(legacy.sql.prepare("SELECT password_salt FROM member_accounts").get().password_salt, salt);
  } finally { legacy.sql.close(); }
  const invalid = setup("200000");
  try { await assert.rejects(invalid.load("lib/password").hashPassword(password), /runtime review/); }
  finally { invalid.sql.close(); }
});

test("legacy hashes remain verifiable, malformed records and unbounded work factors are rejected", async () => {
  const ctx = setup();
  try {
    const crypto = ctx.load("lib/password");
    for (const iterations of [100_000, 200_000, 600_000]) assert.equal(await crypto.verifyPassword(password, vector(iterations), salt, iterations), true);
    for (const iterations of [0, -1, 99_999, 1_000_001, Infinity, NaN, 600_000.5]) assert.equal(await crypto.verifyPassword(password, "a".repeat(64), salt, iterations), false);
    for (const [hash, value] of [["G".repeat(64), salt], ["a".repeat(63), salt], ["a".repeat(64), "b".repeat(31)], ["a".repeat(64), "z".repeat(32)]]) assert.equal(await crypto.verifyPassword(password, hash, value, 600_000), false);
  } finally { ctx.sql.close(); }
});

test("legacy runtime preserves bootstrap migration but an old secret cannot overwrite a reset account", async () => {
  const ctx = setup("");
  try {
    const crypto = ctx.load("lib/password");
    assert.equal(crypto.passwordIterationsSupported(100_000), true);
    assert.equal(crypto.passwordIterationsSupported(200_000), false);
    assert.equal(await crypto.verifyPassword(password, vector(200_000), salt, 200_000), false);
    ctx.sql.prepare("INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations) VALUES(1,'reader',?,?,200000)").run(vector(200_000), salt);
    const accounts = ctx.load("db/accounts");
    assert.deepEqual(await accounts.authenticateAccount("reader", password), { memberId: 1, sessionVersion: 1 });
    assert.equal(ctx.sql.prepare("SELECT password_iterations FROM member_accounts").get().password_iterations, 100_000);
    const replacement = vector(600_000, "Replacement-Secret-85329");
    ctx.sql.prepare("UPDATE member_accounts SET password_hash=?,password_salt=?,password_iterations=600000,session_version=2").run(replacement, salt);
    await assert.rejects(accounts.authenticateAccount("reader", password), /PASSWORD_REHASH_REQUIRED/);
    assert.equal((await accounts.changeMemberPassword(1, password, "Another-Sample-49328")).ok, false);
    assert.equal(ctx.sql.prepare("SELECT password_hash FROM member_accounts").get().password_hash, replacement);
  } finally { ctx.sql.close(); }
});

test("successful legacy login transparently upgrades the hash without revoking existing sessions", async () => {
  const ctx = setup();
  try {
    ctx.sql.prepare("INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations,session_version) VALUES(1,'reader',?,?,100000,3)").run(vector(100_000), salt);
    const session = await ctx.load("db/accounts").authenticateAccount(" READER ", password);
    assert.deepEqual(session, { memberId: 1, sessionVersion: 3 });
    const row = ctx.sql.prepare("SELECT * FROM member_accounts").get();
    assert.equal(row.password_iterations, 600_000);
    assert.equal(row.session_version, 3);
    assert.notEqual(row.password_salt, salt);
  } finally { ctx.sql.close(); }
});

test("a concurrent password reset wins over a login-time rehash", async () => {
  const ctx = setup();
  try {
    ctx.sql.prepare("INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations) VALUES(1,'reader',?,?,100000)").run(vector(100_000), salt);
    const replacement = vector(600_000, "Replacement-Secret-85329");
    ctx.beforeRead((statement) => {
      if (!statement.startsWith("UPDATE member_accounts SET password_hash")) return;
      ctx.sql.prepare("UPDATE member_accounts SET password_hash=?,password_iterations=600000,session_version=session_version+1").run(replacement);
    });
    assert.equal(await ctx.load("db/accounts").authenticateAccount("reader", password), null);
    const row = ctx.sql.prepare("SELECT * FROM member_accounts").get();
    assert.equal(row.password_hash, replacement);
    assert.equal(row.session_version, 2);
  } finally { ctx.sql.close(); }
});

test("a concurrent account creation cannot be authenticated with the obsolete bootstrap password", async () => {
  const ctx = setup();
  try {
    const replacement = vector(600_000, "Replacement-Secret-85329");
    ctx.beforeWrite((statement) => {
      if (!statement.includes("INSERT INTO member_accounts")) return;
      ctx.sql.prepare("INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations,session_version) VALUES(1,'reader',?,?,600000,2)").run(replacement, salt);
    });
    assert.equal(await ctx.load("db/accounts").authenticateAccount("reader", password), null);
    assert.equal(ctx.sql.prepare("SELECT session_version FROM member_accounts").get().session_version, 2);
  } finally { ctx.sql.close(); }
});
