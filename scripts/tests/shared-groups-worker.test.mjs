import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { legacyMigrations, canonicalMigrations } from "../production-migration-policy.mjs";

const require = createRequire(import.meta.url), toolchain = createRequire(require.resolve("wrangler/package.json"));
const { Miniflare } = toolchain("miniflare"), { build } = toolchain("esbuild");
const { outputFiles } = await build({ stdin: { resolveDir: process.cwd(), sourcefile: "shared-groups-worker-test.ts", contents: `
  import { createSessionToken } from './lib/auth.ts';
  import { createReadingGroup, joinReadingGroup, manageInvitations } from './db/onboarding-groups.ts';
  import { GET as state } from './app/api/state/route.ts';
  import { POST as action } from './app/api/action/route.ts';
  import { POST as upload } from './app/api/upload/route.ts';
  import { GET as media } from './app/api/media/[key]/route.ts';
  import { GET as calendar } from './app/api/calendar/[meetingId]/route.ts';
  import { GET as preferences, POST as savePreference } from './app/api/groups/notifications/route.ts';
  import { flush } from 'next/server';
  export default { async fetch(request) {
    try {
      const path = new URL(request.url).pathname;
      if(path === '/test/session') return Response.json(await createSessionToken((await request.json()).accountId, 1));
      if(path === '/test/create') { const body=await request.json(); return Response.json(await createReadingGroup(body.accountId, body)); }
      if(path === '/test/join') { const body=await request.json(); return Response.json(await joinReadingGroup(body.accountId, body.token)); }
      if(path === '/test/invite') return Response.json(await manageInvitations(request, 'create'));
      if(path === '/api/state') return state(request);
      if(path === '/api/action') return action(request);
      if(path === '/api/upload') return upload(request);
      if(path === '/api/groups/notifications') return request.method==='GET' ? preferences(request) : savePreference(request);
      if(path === '/test/flush') { await flush(); return Response.json({ok:true}); }
      if(path.startsWith('/api/media/')) return media(request,{params:Promise.resolve({key:path.split('/').at(-1)})});
      if(path.startsWith('/api/calendar/')) return calendar(request,{params:Promise.resolve({meetingId:path.split('/').at(-1)})});
      return new Response(null,{status:404});
    } catch(error) { return Response.json({code:error.code||'TEST_FAILURE',error:error.message},{status:error.status||500}); }
  }};` }, bundle: true, write: false, format: "esm", platform: "browser", target: "es2022", external: ["cloudflare:workers", "node:*"],
  plugins: [{ name: "no-provider-mail", setup(builder) {
    builder.onResolve({ filter: /^next\/server$/ }, () => ({ path: "after", namespace: "test-only" }));
    builder.onLoad({ filter: /.*/, namespace: "test-only" }, () => ({ contents: "const tasks=[];export const after=task=>tasks.push(task);export const flush=async()=>{while(tasks.length)await tasks.shift()()};" }));
  } }],
});

async function fixture(communication = false) {
  const worker = new Miniflare({ modules: true, script: outputFiles[0].text, compatibilityDate: "2026-05-15", compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"], bindings: { SHARED_GROUPS_ENABLED: "true", READING_GROUPS_ENABLED: "true", SELF_SERVICE_ENABLED: "true",
      READING_GROUP_DB_BINDINGS: "[]", SELF_SERVICE_GROUP_BINDINGS: "[]", SELF_SERVICE_LOCAL: communication ? "true" : "false", APPLICATION_BRAND: "Koru",
      SESSION_SECRET: "Synthetic-shared-worker-secret-at-least-32" },
    outboundService() { throw Error("No real network/provider/mail is allowed in this test"); },
  });
  const db = await worker.getD1Database("DB");
  for (const name of [...legacyMigrations, ...canonicalMigrations, "0015_shared_group_storage", ...(communication ? ["0016_meeting_details", "0017_group_communication"] : [])]) {
    const sql = readFileSync(new URL(`../../drizzle/${name}.sql`, import.meta.url), "utf8");
    await db.batch(sql.split("--> statement-breakpoint").filter((part) => part.trim()).map((sql) => db.prepare(sql.trim())));
  }
  for (let id = 1; id <= 5; id++) await db.batch([
    db.prepare("INSERT INTO members(id,name,role) VALUES(?,?,'super_admin')").bind(id, "Reader " + id),
    db.prepare("INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations) VALUES(?,?,?, ?,100000)").bind(id, "reader" + id, "a".repeat(64), "b".repeat(32)),
    db.prepare("INSERT INTO account_profiles(member_id,email,verified_at,policy_version) VALUES(?,?,1,'fixture')").bind(id, "reader" + id + "@example.test"),
    db.prepare("INSERT INTO reading_group_memberships(account_member_id,group_id,member_id) VALUES(?,'default',?)").bind(id, id),
  ]);
  const sessions = new Map();
  async function call(path, body, accountId, groupId, extra = {}) {
    if (accountId && !sessions.has(accountId)) {
      const response = await worker.dispatchFetch("https://birkoru.com/test/session", { method: "POST", body: JSON.stringify({ accountId }) });
      sessions.set(accountId, await response.json());
    }
    const isForm = body instanceof FormData;
    const multipart = isForm ? new Request("https://fixture.example.test", { method: "POST", body }) : null;
    return worker.dispatchFetch("https://birkoru.com" + path, { method: body === undefined ? "GET" : "POST", headers: {
      Origin: "https://birkoru.com", "Content-Type": multipart ? multipart.headers.get("Content-Type") : "application/json",
      ...(accountId ? { Cookie: "okuma_session=" + sessions.get(accountId) + "; okuma_group=" + groupId } : {}),
      ...(groupId ? { "X-Reading-Group": groupId } : {}), ...extra,
    }, ...(body === undefined ? {} : { body: multipart ? await multipart.arrayBuffer() : JSON.stringify(body) }) });
  }
  async function create(accountId, name = "Group " + accountId, requestKey = crypto.randomUUID()) {
    const response = await call("/test/create", { accountId, name, requestKey });
    assert.equal(response.status, 200, JSON.stringify(await response.clone().json())); return (await response.json()).group;
  }
  return { worker, db, call, create };
}

test("actual workerd D1 creates more than three groups and concurrent idempotent retries reserve exactly one roster", async () => {
  const f = await fixture();
  try {
    for (let id = 1; id <= 3; id++) { await f.create(id, "First " + id); await f.create(id, "Second " + id); }
    const key = crypto.randomUUID();
    const concurrent = await Promise.all(Array.from({ length: 8 }, () => f.create(4, "Concurrent", key)));
    assert.equal(new Set(concurrent.map((g) => g.id)).size, 1);
    assert.equal((await f.db.prepare("SELECT count(*) AS n FROM shared_group_storage").first()).n, 7);
    assert.equal((await f.db.prepare("SELECT count(*) AS n FROM shared_members").first()).n, 7);
    assert.equal((await f.db.prepare("SELECT count(*) AS n FROM members").first()).n, 5);
    assert.deepEqual((await f.db.prepare("PRAGMA foreign_key_check").all()).results, []);
  } finally { await f.worker.dispose(); }
});

test("actual workerd transactions preserve meeting revisions, private change mail, calendar and scoped group images", async () => {
  const f = await fixture(true);
  try {
    const a = await f.create(1, "Meeting Group"), b = await f.create(2, "Other Group");
    assert.equal((await f.call("/api/groups/notifications", { enabled: true }, 1, a.id)).status, 200);
    const created = await f.call("/api/action", { action: "createMeeting", date: "2028-10-20T18:00", kind: "online", book: { title: "Online Book", author: "Author" } }, 1, a.id);
    assert.equal(created.status, 200, await created.clone().text());
    const meetingId = (await created.json()).meetingId;
    const edit = { action: "editMeeting", meetingId, revision: 1, date: "2028-10-21T20:00", kind: "online", onlineUrl: "https://meet.example/new" };
    const updates = await Promise.all([f.call("/api/action", edit, 1, a.id), f.call("/api/action", { ...edit, date: "2028-10-22T20:00" }, 1, a.id)]);
    assert.deepEqual(updates.map((response) => response.status).sort(), [200, 409]);
    await f.call("/test/flush");
    const state = await (await f.call("/api/state", undefined, 1, a.id)).json();
    assert.equal(state.meetings[0].revision, 2); assert.equal(state.meetings[0].kind, "online"); assert.equal(state.meetingChanges.length, 1);
    assert.equal((await f.db.prepare("SELECT count(*) AS n FROM development_mail").first()).n, 1);
    await f.call("/test/flush");
    assert.equal((await f.db.prepare("SELECT count(*) AS n FROM development_mail").first()).n, 1);
    const calendar = await (await f.call("/api/calendar/" + meetingId, undefined, 1, a.id)).text();
    assert.match(calendar, /SEQUENCE:2/); assert.match(calendar, /LOCATION:https:\/\/meet.example\/new/);
    const foreign = await (await f.call("/api/state", undefined, 2, b.id)).json();
    assert.deepEqual(foreign.meetingChanges, []);
    assert.equal((await f.call("/api/calendar/" + meetingId, undefined, 2, b.id)).status, 404);
    const form = new FormData(); form.set("purpose", "groupHero");
    form.set("file", new File([readFileSync(new URL("../../public/brand/koru-192-v2.png", import.meta.url))], "fixture.png", { type: "image/png" }));
    const upload = await f.call("/api/upload", form, 1, a.id); assert.equal(upload.status, 200, await upload.clone().text());
    const { mediaKey } = await upload.json();
    assert.equal((await f.call("/api/media/" + mediaKey, undefined, 2, b.id)).status, 404);
    assert.equal((await f.call("/api/action", { action: "resetGroupHero" }, 1, a.id)).status, 200);
    assert.equal((await f.call("/api/media/" + mediaKey, undefined, 1, a.id)).status, 404);
    assert.deepEqual((await f.db.prepare("PRAGMA foreign_key_check").all()).results, []);
  } finally { await f.worker.dispose(); }
});

test("real Worker endpoints isolate media, calendar, state and mutations with one D1 and preserve legacy group reads", async () => {
  const f = await fixture();
  try {
    const a = await f.create(1, "Alpha"), b = await f.create(2, "Beta");
    const payload = { action: "createMeeting", date: "2099-10-20T18:00", location: "Fixture", book: { title: "Private Alpha", author: "Author" } };
    const created = await f.call("/api/action", payload, 1, a.id); assert.equal(created.status, 200);
    const meetingId = (await created.json()).meetingId;
    const form = new FormData(); form.set("purpose", "photo"); form.set("meetingId", String(meetingId));
    form.set("file", new File([Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])], "synthetic.png", { type: "image/png" }));
    const uploaded = await f.call("/api/upload", form, 1, a.id); assert.equal(uploaded.status, 200);
    const { mediaKey } = await uploaded.json();
    const own = await f.call("/api/media/" + mediaKey, undefined, 1, a.id); assert.equal(own.status, 200); assert.match(own.headers.get("Cache-Control"), /no-store/);
    assert.equal((await f.call("/api/media/" + mediaKey, undefined, 2, b.id)).status, 404);
    assert.equal((await f.call("/api/calendar/" + meetingId, undefined, 2, b.id)).status, 404);
    const calendar = await f.call("/api/calendar/" + meetingId, undefined, 1, a.id); assert.equal(calendar.status, 200); assert.match(await calendar.text(), /Private Alpha/);
    const beta = await f.call("/api/state", undefined, 2, b.id); assert.equal(beta.status, 200); assert.equal((await beta.json()).books.length, 0);
    assert.equal((await f.call("/api/state", undefined, 1, b.id)).status, 403);
    assert.equal((await f.call("/api/action", { action: "clearBookVotes" }, 1, a.id, { "X-Reading-Group": b.id })).status, 409);
    const invite = await f.call("/test/invite", {}, 1, a.id); assert.equal(invite.status, 200);
    const joined = await f.call("/test/join", { accountId: 2, token: (await invite.json()).token }); assert.equal(joined.status, 200); assert.equal((await joined.json()).group.role, "member");
    assert.equal((await f.call("/api/action", payload, 2, a.id)).status, 403);
    const legacy = await f.call("/api/state", undefined, 1, "default"); assert.equal(legacy.status, 200); assert.equal((await legacy.json()).members.length, 5);
    assert.deepEqual((await f.db.prepare("PRAGMA foreign_key_check").all()).results, []);
  } finally { await f.worker.dispose(); }
});
