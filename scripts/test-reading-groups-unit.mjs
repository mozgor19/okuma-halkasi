import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = fileURLToPath(new URL("../", import.meta.url));
const repoRequire = createRequire(path.join(root, "package.json"));
const ts = repoRequire("typescript");
globalThis.crypto ??= require("node:crypto").webcrypto;
const env = { SESSION_SECRET: "test-session-secret-with-at-least-32-characters" };
const loaded = new Map();
function load(name) {
  const filename = path.join(root, name + ".ts");
  if (loaded.has(filename)) return loaded.get(filename).exports;
  const compiledModule = { exports: {} };
  loaded.set(filename, compiledModule);
  const compiled = ts.transpileModule(fs.readFileSync(filename, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  new Function("require", "module", "exports", compiled)((specifier) => {
    if (specifier === "cloudflare:workers") return { env };
    if (specifier.startsWith("@/")) return load(specifier.slice(2));
    return repoRequire(specifier);
  }, compiledModule, compiledModule.exports);
  return compiledModule.exports;
}
const defaultGroup = { id: "default", name: "Default", bindingName: "DB", memberId: 1, scheme: "notebook", mode: "system" };
const secondGroup = { id: "second", name: "Second", bindingName: "GROUP_SECOND", memberId: 7, scheme: "minimal", mode: "dark" };
let memberships = [defaultGroup, secondGroup];
let guest = false;
let missingAccounts = false;
let missingRegistry = false;
let legacyRegistry = false;
let canonicalReads = 0;
let domainCalls = 0;
function db(kind) {
  return {
    batch: async () => { throw Error("Unexpected batch"); },
    prepare(sql) {
      let values;
      return {
        bind(...args) { values = args; return this; },
        async first() {
          if (sql.includes("sqlite_master")) return legacyRegistry ? { name: "reading_group_memberships" } : null;
          if (sql.includes("JOIN reading_groups")) {
            assert.ok(sql.includes("m.is_active = 1"));
            return memberships.find((group) => group.id === "default" && group.isActive !== false) ?? null;
          }
          if (sql.includes("FROM member_accounts")) {
            assert.equal(kind, "identity", "credential read escaped canonical DB");
            canonicalReads++;
            if (missingAccounts) throw Error("no such table: member_accounts");
            return { memberId: 1, sessionVersion: 0 };
          }
          assert.ok(sql.includes("FROM members"), sql);
          const id = kind === "identity" ? 1 : 7;
          if (values[0] !== id || (sql.includes("is_guest = 0") && guest && kind !== "identity")) return null;
          return { id, name: kind, role: kind === "identity" ? "super_admin" : "member", color: "#fff", isGuest: kind !== "identity" && guest ? 1 : 0 };
        },
        async all() {
          assert.equal(kind, "identity");
          assert.ok(sql.includes("FROM reading_group_memberships"));
          assert.ok(sql.includes("m.is_active = 1"));
          if (missingRegistry) throw Error("no such table: reading_group_memberships");
          return { results: memberships.filter((group) => group.isActive !== false) };
        },
      };
    },
  };
}
env.DB = db("identity");
env.GROUP_SECOND = db("second");
env.READING_GROUP_DB_BINDINGS = '["GROUP_SECOND"]';
const database = load("db/database");
const auth = load("lib/auth");
const groups = load("lib/groups");
const accounts = load("db/accounts");
const store = load("db/store");
const originalError = console.error;
// Expected fail-closed paths log errors; assertions below verify their responses.
console.error = () => {};
async function main() {
  const token = await auth.createSessionToken(1, 0);
  function request(group, method = "GET", headers = {}, query = "") {
    return new Request("https://local.test/api/state" + query, {
      method,
      headers: { cookie: "okuma_session=" + token + (group === undefined ? "" : "; okuma_group=" + group), ...headers },
    });
  }
  const wrapped = groups.withReadingGroup(async (req) => {
    domainCalls++;
    const member = await store.getAuthenticatedMember(req);
    await new Promise((resolve) => setTimeout(resolve, member.id === 1 ? 10 : 1));
    assert.ok(await accounts.sessionAccountIsCurrent({ memberId: 1, sessionVersion: 0 }));
    const ctx = database.readingGroupContext();
    assert.equal(database.database(), ctx.db);
    return Response.json({ memberId: member.id, group: ctx.group.id, role: member.role });
  });
  let checks = 0;
  async function expect(req, status, code) {
    const before = domainCalls;
    const response = await wrapped(req);
    assert.equal(response.status, status);
    assert.match(response.headers.get("cache-control"), /no-store/);
    if (code) {
      assert.equal((await response.json()).code, code);
      assert.equal(domainCalls, before, "guard failure reached domain handler");
    }
    checks++;
    return response;
  }
  for (const flag of [undefined, "false", "TRUE", "1"]) {
    env.READING_GROUPS_ENABLED = flag;
    const before = canonicalReads;
    const result = await groups.withReadingGroup(async () => Response.json({ legacy: true }))(request());
    assert.deepEqual(await result.json(), { legacy: true });
    assert.equal(canonicalReads, before);
    checks++;
    const legacy = groups.withReadingGroup(async () => Response.json({ legacy: true }));
    for (const rejected of [request(undefined, "GET", {}, "?group=second"), request(undefined, "POST", { "X-Reading-Group": "second" }), request(undefined, "GET", {}, "?group=default&group=default")]) {
      const blocked = await legacy(rejected);
      assert.equal(blocked.status, 503);
      assert.equal((await blocked.json()).code, "GROUP_DISABLED");
      assert.equal(canonicalReads, before);
      checks++;
    }
    assert.deepEqual(await (await legacy(request(undefined, "GET", { "X-Reading-Group": "default" }, "?group=default"))).json(), { legacy: true });
    checks++;
  }
  env.READING_GROUPS_ENABLED = "true";
  await expect(request(), 409, "GROUP_SELECTION_REQUIRED");
  await expect(request("other"), 403, "GROUP_ACCESS_DENIED");
  await expect(request("second", "POST"), 409, "GROUP_CHANGED");
  await expect(request("second", "POST", { "X-Reading-Group": "default", origin: "https://local.test" }), 409, "GROUP_CHANGED");
  await expect(request("second", "POST", { "X-Reading-Group": "second", origin: "https://evil.test" }), 403, "INVALID_ORIGIN");
  await expect(request("second", "POST", { "X-Reading-Group": "second" }), 403, "INVALID_ORIGIN");
  await expect(request("second", "GET", {}, "?group=default"), 409, "GROUP_CHANGED");
  await expect(request("second", "GET", {}, "?group=second&group=second"), 409, "GROUP_CHANGED");
  await expect(request("second", "GET", { "X-Reading-Group": "default" }), 409, "GROUP_CHANGED");
  await expect(request("second", "POST", { "X-Reading-Group": "second", origin: "https://local.test" }), 200);
  const concurrent = await Promise.all(Array.from({ length: 20 }, async (_, index) => {
    const group = index % 2 ? "second" : "default";
    const response = await wrapped(request(group));
    assert.deepEqual(await response.json(), group === "second"
      ? { memberId: 7, group: "second", role: "member" }
      : { memberId: 1, group: "default", role: "super_admin" });
    return group;
  }));
  assert.equal(concurrent.length, 20);
  assert.equal(database.readingGroupContext(), undefined);
  assert.equal(database.database(), env.DB);
  assert.equal((await store.getAuthenticatedMember(request())).id, 1);
  checks += 20;
  const listed = await groups.accountReadingGroups(1);
  assert.equal(listed[0].role, "super_admin");
  assert.equal(listed[1].role, "member");
  assert.equal(listed[1].scheme, "minimal");
  assert.ok(!("bindingName" in listed[1]));
  checks++;
  memberships = [secondGroup];
  assert.equal((await (await expect(request(), 200)).json()).memberId, 7);
  await expect(request("default"), 403, "GROUP_ACCESS_DENIED");
  memberships = [];
  await expect(request(), 403, "GROUP_ACCESS_DENIED");
  memberships = [defaultGroup, secondGroup];
  guest = true;
  await expect(request("second"), 403, "GROUP_ACCESS_DENIED");
  guest = false;
  env.READING_GROUP_DB_BINDINGS = "[]";
  await expect(request("second"), 503, "GROUP_UNAVAILABLE");
  env.READING_GROUP_DB_BINDINGS = '["GROUP_SECOND"]';
  const secondDb = env.GROUP_SECOND;
  delete env.GROUP_SECOND;
  await expect(request("second"), 503, "GROUP_UNAVAILABLE");
  env.GROUP_SECOND = env.DB;
  await expect(request("second"), 503, "GROUP_UNAVAILABLE");
  env.GROUP_SECOND = secondDb;
  missingRegistry = true;
  await expect(request("default"), 503, "GROUP_UNAVAILABLE");
  missingRegistry = false;
  missingAccounts = true;
  await expect(request("default"), 503, "GROUP_UNAVAILABLE");
  env.READING_GROUPS_ENABLED = "false";
  assert.equal(await accounts.sessionAccountIsCurrent({ memberId: 1, sessionVersion: 0 }), true);
  checks++;
  for (const unsafe of ["//evil.test", "/\\evil.test", "/%5cevil.test", "/%2f%2fevil.test", "/%255cevil.test", "/\tevil.test", "https://evil.test"]) {
    assert.equal(auth.safeNextPath(unsafe), "/");
    checks++;
  }
  assert.equal(auth.safeNextPath("/?meeting=1&group=second"), "/?meeting=1&group=second");
  checks++;
  missingAccounts = false;
  env.READING_GROUPS_ENABLED = "true";
  const { proxy } = load("proxy");
  const { NextRequest } = repoRequire("next/server");
  async function expectSelectionRedirect(pathname, selected, next) {
    const req = new NextRequest("https://local.test" + pathname, {
      headers: { cookie: request(selected).headers.get("cookie") },
    });
    const response = await proxy(req);
    assert.equal(response.status, 307);
    const location = new URL(response.headers.get("location"));
    assert.equal(location.origin, "https://local.test");
    assert.equal(location.pathname, "/groups");
    assert.equal(location.searchParams.get("next"), next);
    assert.equal(response.headers.get("set-cookie"), null, "proxy must not silently select a group");
    assert.match(response.headers.get("cache-control"), /no-store/);
    checks++;
  }
  await expectSelectionRedirect("/?meeting=1&group=second", "default", "/?meeting=1&group=second");
  await expectSelectionRedirect("/?meeting=1&group=second", undefined, "/?meeting=1&group=second");
  await expectSelectionRedirect("/login?next=%2F%3Fmeeting%3D1%26group%3Dsecond", undefined, "/?meeting=1&group=second");
  await expectSelectionRedirect("/?meeting=1&group=second", "revoked", "/?meeting=1&group=second");
  await expectSelectionRedirect("/login?next=%2F%2Fevil.test", "revoked", null);
  const groupsRoute = load("app/api/groups/route");
  const repaired = await groupsRoute.GET(request("revoked"));
  assert.equal(repaired.status, 200);
  assert.equal((await repaired.json()).selectedGroupId, null);
  checks++;
  memberships = [];
  await expectSelectionRedirect("/", "revoked", null);
  const denied = await groupsRoute.GET(request("revoked"));
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "GROUP_ACCESS_DENIED");
  assert.match(denied.headers.get("cache-control"), /no-store/);
  checks++;
  env.READING_GROUPS_ENABLED = "false";
  for (const [group, status] of [["second", 503], ["default", 200]]) {
    const response = await proxy(new NextRequest("https://local.test/?meeting=1&group=" + group, { headers: { cookie: request().headers.get("cookie") } }));
    assert.equal(response.status, status);
    if (status === 503) assert.equal((await response.json()).code, "GROUP_DISABLED");
    checks++;
  }
  legacyRegistry = true;
  for (const available of [[], [secondGroup], [{ ...defaultGroup, isActive: false }]]) {
    memberships = available;
    const response = await proxy(new NextRequest("https://local.test/", { headers: { cookie: request().headers.get("cookie") } }));
    assert.equal(response.status, 403, "Rollback must not grant default-group access");
    await assert.rejects(groups.legacyAccountReadingGroup(1), (error) => error.code === "GROUP_ACCESS_DENIED");
    checks += 2;
  }
  memberships = [defaultGroup, secondGroup];
  const legacyResolved = await groups.legacyAccountReadingGroup(1);
  assert.equal(legacyResolved.context.memberId, 1);
  const legacyState = await groups.withReadingGroup(async () => Response.json({ group: database.readingGroupContext().group.id }))(request("second"));
  assert.deepEqual(await legacyState.json(), { group: "default" });
  checks += 2;
  env.READING_GROUPS_ENABLED = "true";
  memberships = [{ ...defaultGroup, isActive: false }, secondGroup];
  assert.deepEqual((await groups.accountReadingGroups(1)).map((group) => group.id), ["second"]);
  checks++;
  console.log(checks + " backend isolation, guard, legacy, and redirect checks passed.");
}
main().catch((error) => { originalError(error); process.exitCode = 1; })
  .finally(() => { console.error = originalError; });
