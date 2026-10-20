import assert from "node:assert/strict";
import test from "node:test";
import { erasureCommand } from "../account-erasure.mjs";
import { firebaseAccountFixture, newPassword } from "../fixtures/firebase-account-test.mjs";

const requestId = "11111111-1111-4111-8111-111111111111";
async function fixture() {
  const f = firebaseAccountFixture(), { user } = await f.register(); user.verified = true;
  const accounts = f.load("db/firebase-accounts"), signed = await accounts.authenticateFirebaseAccount("new.reader", newPassword);
  f.sql.prepare("INSERT INTO account_deletion_requests(id,member_id,requested_at,updated_at) VALUES(?,?,1,1)").run(requestId, signed.memberId);
  const erased = [], hooks = { providerFailure: false };
  const provider = { async erase(uid) { if (hooks.providerFailure) throw Error("Synthetic provider outage"); erased.push(uid); f.users.delete(user.email); } };
  const coordinator = f.load("db/firebase-erasure").firebaseErasureCoordinator(f.db, provider);
  const service = f.load("db/account-erasure").accountErasureService(f.db, { DB: f.db }, coordinator);
  const approval = async () => { const inspected = await service.inspect(requestId); return { expectedDigest: inspected.digest, confirmation: inspected.plan.confirmation, writersStopped: true, contentReviewComplete: true }; };
  return { ...f, accounts, signed, user, erased, hooks, coordinator, service, approval };
}

test("coordinated erasure deletes provider identity before D1 finalization, clears every identity FK, retains a redacted checkpoint and is idempotent", async () => {
  const f = await fixture();
  try {
    const handle = await f.accounts.createFirebaseSession(f.signed.memberId, f.signed.sessionVersion, f.signed.firebase);
    const plan = await f.service.inspect(requestId); assert.deepEqual(plan.plan.blockers, []); assert.equal(plan.plan.identity.count, 1);
    assert.doesNotMatch(JSON.stringify(plan), /new@example|synthetic-uid|Synthetic Reader|synthetic-refresh/);
    assert.equal((await f.service.execute(requestId, await f.approval())).completed, true);
    assert.deepEqual(f.erased, [f.user.uid]); assert.equal(f.users.size, 0);
    for (const table of ["firebase_links", "firebase_sessions", "firebase_registrations", "member_accounts", "account_profiles", "account_deletion_requests"]) assert.equal(f.sql.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
    const checkpoint = f.sql.prepare("SELECT * FROM account_erasure_provider_checkpoints").get(); assert.ok(checkpoint.deleted_at);
    assert.doesNotMatch(JSON.stringify(checkpoint), /synthetic-uid|new@example|synthetic-refresh/);
    assert.equal(await f.accounts.firebaseSessionIdentity(handle), null);
    assert.deepEqual(f.sql.prepare("PRAGMA foreign_key_check").all(), []);
    const again = await f.service.execute(requestId, await f.approval()); assert.equal(again.alreadyCompleted, true); assert.equal(f.erased.length, 1);
  } finally { f.close(); }
});

test("provider failure freezes identity and wipes handle credentials but never deletes group data; an explicit retry resumes", async () => {
  const f = await fixture();
  try {
    f.sql.exec("INSERT INTO books(id,title,author) VALUES(1,'Synthetic','Synthetic'); INSERT INTO meetings(id,book_id,date,location,created_by) VALUES(1,1,'2026-10-20','Synthetic',1); INSERT INTO reviews(meeting_id,member_id,rating,comment) VALUES(1,1,5,'Synthetic private review')");
    const handle = await f.accounts.createFirebaseSession(f.signed.memberId, f.signed.sessionVersion, f.signed.firebase), approved = await f.approval();
    f.hooks.providerFailure = true;
    await assert.rejects(f.service.execute(requestId, approved), /Synthetic provider outage/);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM reviews").get().n, 1);
    assert.equal(f.sql.prepare("SELECT sealed_credentials FROM firebase_sessions").get().sealed_credentials, "");
    assert.equal(f.sql.prepare("SELECT status FROM account_deletion_requests").get().status, "processing");
    assert.equal(await f.accounts.firebaseSessionIdentity(handle), null);
    assert.equal(await f.accounts.authenticateFirebaseAccount("new.reader", newPassword), null);
    f.hooks.providerFailure = false;
    assert.equal((await f.service.execute(requestId, approved)).completed, true);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM reviews").get().n, 0);
  } finally { f.close(); }
});

test("lost canonical finalization never repeats an acknowledged provider deletion", async () => {
  const f = await fixture();
  try {
    const original = f.db.batch.bind(f.db), approved = await f.approval(); let fault = true;
    f.db.batch = async (statements) => {
      if (fault && statements.some((statement) => statement.statement === "DELETE FROM member_accounts WHERE member_id = ?")) throw Error("Synthetic finalization fault");
      return original(statements);
    };
    await assert.rejects(f.service.execute(requestId, approved), /Synthetic finalization fault/);
    assert.equal(f.erased.length, 1); assert.equal(f.sql.prepare("SELECT count(*) AS n FROM member_accounts").get().n, 1);
    fault = false; assert.equal((await f.service.execute(requestId, approved)).completed, true); assert.equal(f.erased.length, 1);
  } finally { f.close(); }
});

test("orphan/foreign/mutated provider identities cannot be adopted or erased through an approved old plan", async () => {
  for (const change of [
    "UPDATE firebase_links SET project_id='koru-auth-test'",
    "UPDATE firebase_links SET firebase_uid='another-synthetic-uid'",
    "UPDATE firebase_registrations SET firebase_uid=NULL",
  ]) {
    const f = await fixture();
    try {
      const approved = await f.approval(); f.sql.exec(change);
      await assert.rejects(f.service.execute(requestId, approved), /ERASURE_/);
      assert.equal(f.erased.length, 0); assert.equal(f.sql.prepare("SELECT count(*) AS n FROM account_erasure_jobs").get().n, 0);
    } finally { f.close(); }
  }
});

test("admin erasure is project/UID bound, filters private fields, confirms absence and handles an ambiguous response without retrying DELETE", async () => {
  const f = firebaseAccountFixture();
  try {
    const { firebaseErasureAdmin } = f.load("lib/firebase-admin-erasure"), token = "synthetic-operator-access-token", visited = [];
    let present = true;
    const admin = firebaseErasureAdmin(token, async (url, options) => {
      const parsed = new URL(url); visited.push(parsed.pathname);
      assert.equal(parsed.origin, "https://identitytoolkit.googleapis.com"); assert.match(parsed.pathname, /^\/v1\/projects\/koru-951bf\/accounts:/);
      assert.equal(options.redirect, "manual"); assert.equal(options.headers.Authorization, `Bearer ${token}`);
      if (parsed.pathname.endsWith(":lookup")) { assert.deepEqual(JSON.parse(options.body), { localId: ["synthetic-uid"] }); assert.equal(parsed.searchParams.get("fields"), "users(localId,tenantId)"); return Response.json(present ? { users: [{ localId: "synthetic-uid" }] } : {}); }
      assert.deepEqual(JSON.parse(options.body), { localId: "synthetic-uid" }); present = false; throw Error("Synthetic lost response with private token");
    });
    await admin.erase("synthetic-uid"); await admin.erase("synthetic-uid");
    assert.equal(visited.filter((path) => path.endsWith(":delete")).length, 1);
    for (const response of [new Response(null, { status: 302, headers: { Location: "https://foreign.example.test" } }), new Response(null, { status: 403 }), Response.json({ users: [{ localId: "other" }] }), Response.json({ users: [{ localId: "synthetic-uid", tenantId: "foreign" }] })]) {
      await assert.rejects(firebaseErasureAdmin(token, async () => response).erase("synthetic-uid"), (error) => { assert.doesNotMatch(error.message, /private|token|foreign\.example/); return true; });
    }
  } finally { f.close(); }
});

test("operator boundary rejects member cookies, missing/wrong credentials, foreign origins and mutable binding inventories", () => {
  const f = firebaseAccountFixture();
  try {
    const { requireErasureOperator, requireErasureMaintenance, erasureBindings } = f.load("lib/erasure-operator"), secret = "a".repeat(64);
    const settings = { AUTH_PUBLIC_ORIGIN: "https://birkoru.com", ERASURE_OPERATOR_SECRET: secret };
    assert.throws(() => requireErasureOperator(new Request("https://birkoru.com/api/operations/erasure", { headers: { Cookie: "okuma_session=synthetic" } }), settings));
    for (const header of ["Bearer " + "b".repeat(64), "Bearer " + secret + ",Bearer " + secret, secret]) assert.throws(() => requireErasureOperator(new Request(f.request.url, { headers: { Authorization: header } }), settings));
    const headers = { Authorization: "Bearer " + secret };
    requireErasureOperator(new Request(f.request.url, { headers }), settings);
    assert.throws(() => requireErasureOperator(new Request(f.request.url, { headers: { ...headers, Origin: "https://foreign.example.test" } }), settings));
    assert.throws(() => requireErasureMaintenance(settings)); requireErasureMaintenance({ MAINTENANCE_MODE: "true" });
    for (const value of ['["DB"]', '["GROUP","GROUP"]', '["../private"]', '{}']) assert.throws(() => erasureBindings({ READING_GROUP_DB_BINDINGS: value }));
  } finally { f.close(); }
});

test("operator CLI requires exact request/digest/review and has no secret, arbitrary-origin or account-ID options", () => {
  assert.deepEqual(erasureCommand(["--queue"]), { action: "queue" });
  assert.equal(erasureCommand(["--request=" + requestId]).action, "inspect");
  const args = ["--request=" + requestId, "--execute", "--digest=" + "a".repeat(64), "--confirmation=ERASE:" + requestId + ":1", "--ack=writers-drained-and-content-reviewed"];
  assert.equal(erasureCommand(args).action, "execute");
  for (const invalid of [[], ["--queue", "--execute"], args.slice(0, -1), ["--request=../private"], ["--origin=https://foreign.example.test"], [...args, "--secret=private"], [...args, "--account=1"]]) assert.throws(() => erasureCommand(invalid));
});
