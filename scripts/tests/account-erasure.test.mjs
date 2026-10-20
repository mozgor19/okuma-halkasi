import assert from "node:assert/strict";
import test from "node:test";
import { pbkdf2Sync } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { DatabaseSync } from "node:sqlite";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const requestId = "11111111-1111-4111-8111-111111111111";
const password = "Synthetic-Password-48296";
const salt = "0123456789abcdef0123456789abcdef";
const passwordHash = pbkdf2Sync(password, Buffer.from(salt, "hex"), 100000, 32, "sha256").toString("hex");
const personalTables = ["attendance", "meeting_rsvps", "reviews", "favorite_books", "book_votes"];

function setup() {
  const stores = {};
  const modules = new Map();
  const env = { READING_GROUPS_ENABLED: "true", PASSWORD_HASH_ITERATIONS: "100000", SESSION_SECRET: "synthetic-secret-that-is-at-least-32-characters", MEMBER_CREDENTIALS: JSON.stringify({ target: { memberId: 1, password } }) };
  function store(name) {
    const sql = new DatabaseSync(":memory:");
    sql.exec("PRAGMA foreign_keys=ON");
    for (const file of ["0000_strange_eternals", "0001_store_media_in_d1", "0002_member_accounts", "0003_member_profiles_and_reading_progress", "0004_face_recognition", "0005_club_tools", "0006_super_admin_roles", "0007_meeting_rsvps", "0010_group_account_links"])
      sql.exec(readFileSync(new URL(`../../drizzle/${file}.sql`, import.meta.url), "utf8"));
    const hooks = { beforeRun: () => {}, beforeBatch: () => {} };
    const db = { prepare(statement) {
      let values = [];
      return {
        statement, get values() { return values; },
        bind(...args) { values = args; return this; },
        async first() { hooks.beforeRun(statement); return sql.prepare(statement).get(...values) ?? null; },
        async all() { return { results: sql.prepare(statement).all(...values) }; },
        async run() { hooks.beforeRun(statement); const r = sql.prepare(statement).run(...values); return { meta: { changes: Number(r.changes) } }; },
      };
    }, async batch(statements) {
      hooks.beforeBatch(statements);
      sql.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((item) => {
          const statement = sql.prepare(item.statement);
          if (statement.columns().length) return { results: statement.all(...item.values), meta: { changes: 0 } };
          const result = statement.run(...item.values);
          return { results: [], meta: { changes: Number(result.changes) } };
        });
        sql.exec("COMMIT"); return results;
      } catch (error) { sql.exec("ROLLBACK"); throw error; }
    } };
    return stores[name] = { sql, db, hooks };
  }
  const root = store("DB");
  for (const file of ["0008_reading_groups", "0009_self_service", "0011_account_experience", "0012_account_erasure_jobs"])
    root.sql.exec(readFileSync(new URL(`../../drizzle/${file}.sql`, import.meta.url), "utf8"));
  const second = store("GROUP_SECOND");
  const orphan = store("GROUP_ORPHAN");
  store("GROUP_EMPTY");
  root.sql.exec("INSERT INTO members(id,name,role) VALUES(1,'Target Name','member'),(2,'Other Owner','super_admin'),(3,'Unrelated Reader','member')");
  for (const id of [1, 2, 3]) {
    root.sql.prepare("INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations) VALUES(?,?,?,?,100000)").run(id, id === 1 ? "target" : "reader" + id, passwordHash, salt);
    root.sql.prepare("INSERT INTO account_profiles VALUES(?,?,1,'fixture')").run(id, id === 1 ? "target@example.test" : "reader" + id + "@example.test");
    root.sql.prepare("INSERT INTO reading_group_memberships(account_member_id,group_id,member_id) VALUES(?,'default',?)").run(id, id);
  }
  root.sql.exec("INSERT INTO reading_groups VALUES('second','Second','GROUP_SECOND'),('orphan','Orphan','GROUP_ORPHAN')");
  for (const [group, database, targetRole] of [["second", second, "super_admin"], ["orphan", orphan, "member"]]) {
    database.sql.prepare("INSERT INTO group_database_ownership VALUES(1,?)").run(group);
    database.sql.prepare("INSERT INTO members(id,name,role) VALUES(10,'Target Name',?),(20,'Other Owner',?)").run(targetRole, group === "second" ? "admin" : "super_admin");
    database.sql.exec("INSERT INTO group_account_links VALUES(1,10),(2,20)");
    root.sql.prepare("INSERT INTO reading_group_memberships(account_member_id,group_id,member_id,is_active) VALUES(2,?,20,1)").run(group);
  }
  root.sql.exec("INSERT INTO reading_group_memberships(account_member_id,group_id,member_id,is_active) VALUES(1,'second',10,0)");
  root.sql.prepare("INSERT INTO group_provisioning VALUES('second',1,?,'ready',1)").run("22222222-2222-4222-8222-222222222222");
  root.sql.prepare("INSERT INTO account_deletion_requests(id,member_id,requested_at,updated_at) VALUES(?,1,1,1)").run(requestId);
  root.sql.exec("INSERT INTO account_experience VALUES(1,1,'completed',1)");
  root.sql.prepare("INSERT INTO account_recovery_tokens VALUES(?,1,1,?,NULL)").run("r".repeat(64), Date.now() + 100000);
  root.sql.prepare("INSERT INTO account_email_verifications VALUES(?,1,'target@example.test',1,?,NULL)").run("v".repeat(64), Date.now() + 100000);
  root.sql.prepare("INSERT INTO pending_registrations(token_hash,email,username,name,password_hash,password_salt,password_iterations,expires_at) VALUES(?,'target@example.test','target','Target Name',?,?,100000,?)").run("p".repeat(64), passwordHash, salt, Date.now() + 100000);
  root.sql.prepare("INSERT INTO group_invitations VALUES(?,'second',?,1,1,?,10,NULL)").run("33333333-3333-4333-8333-333333333333", "i".repeat(64), Date.now() + 100000);
  root.sql.prepare("INSERT INTO group_invitation_redemptions VALUES(1,'second',?,'ready',1),(3,'second',?,'ready',1)").run("33333333-3333-4333-8333-333333333333", "33333333-3333-4333-8333-333333333333");
  for (const [binding, targetId, otherId] of [["DB", 1, 2], ["GROUP_SECOND", 10, 20], ["GROUP_ORPHAN", 10, 20]]) {
    const sql = stores[binding].sql;
    sql.exec("INSERT INTO books(id,title,author) VALUES(1,'Shared book','Synthetic Author')");
    sql.prepare("INSERT INTO meetings(id,book_id,date,location,created_by) VALUES(1,1,'2026-10-19','Fixture',?)").run(targetId);
    sql.prepare("INSERT INTO roadmap(id,book_id,created_by) VALUES(1,1,?)").run(targetId);
    for (const memberId of [targetId, otherId]) {
      sql.prepare("INSERT INTO attendance(meeting_id,member_id) VALUES(1,?)").run(memberId);
      sql.prepare("INSERT INTO meeting_rsvps(meeting_id,member_id) VALUES(1,?)").run(memberId);
      sql.prepare("INSERT INTO reviews(meeting_id,member_id,rating,comment) VALUES(1,?,5,?)").run(memberId, memberId === targetId ? "Synthetic private note" : "Keep other review");
      sql.prepare("INSERT INTO favorite_books(member_id,book_id) VALUES(?,1)").run(memberId);
      sql.prepare("INSERT INTO book_votes(member_id,roadmap_id) VALUES(?,1)").run(memberId);
    }
    for (const key of ["target-avatar", "target-face", "target-photo", "other-photo"]) sql.prepare("INSERT INTO media(media_key,content_type,data) VALUES(?,'image/png',X'010203')").run(key);
    sql.prepare("UPDATE members SET avatar_media_key='target-avatar',face_reference_media_key='target-face',face_recognition_consent=1 WHERE id=?").run(targetId);
    sql.prepare("INSERT INTO photos(meeting_id,media_key,uploaded_by) VALUES(1,'target-photo',?),(1,'other-photo',?)").run(targetId, otherId);
  }
  env.DB = root.db;
  function load(name) {
    if (modules.has(name)) return modules.get(name).exports;
    const compiledModule = { exports: {} }; modules.set(name, compiledModule);
    const source = ts.transpileModule(readFileSync(new URL(`../../${name}.ts`, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    new Function("require", "module", "exports", source)((key) => key === "cloudflare:workers" ? { env } : key.startsWith("@/") ? load(key.slice(2)) : require(key), compiledModule, compiledModule.exports);
    return compiledModule.exports;
  }
  const bindings = Object.fromEntries(Object.entries(stores).map(([key, value]) => [key, value.db]));
  const create = load("db/account-erasure").accountErasureService;
  const service = create(root.db, bindings);
  async function approval() {
    const transfers = { second: 2 };
    const inspected = await service.inspect(requestId, transfers);
    return { writersStopped: true, contentReviewComplete: true, transfers, expectedDigest: inspected.digest, confirmation: inspected.plan.confirmation };
  }
  return { stores, root, second, orphan, load, service, create, bindings, approval, close() { for (const value of Object.values(stores)) value.sql.close(); } };
}

test("dry run finds active, inactive and orphaned local mappings without writing or exposing personal data", async () => {
  const ctx = setup();
  try {
    const inspected = await ctx.service.inspect(requestId);
    assert.equal(inspected.plan.steps.length, 3);
    assert.ok(inspected.plan.steps.some((step) => step.binding === "GROUP_ORPHAN" && step.memberId === 10));
    assert.deepEqual(inspected.plan.blockers, ["OWNERSHIP_TRANSFER_REQUIRED:second"]);
    assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM account_erasure_jobs").get().n, 0);
    assert.equal(ctx.root.sql.prepare("SELECT session_version FROM member_accounts WHERE member_id=1").get().session_version, 1);
    assert.doesNotMatch(JSON.stringify(inspected), /target@example|Target Name|password_hash|Synthetic private/);
  } finally { ctx.close(); }
});
test("Firebase identities and pending claims block legacy erasure before freezing or deleting any domain data", async () => {
  for (const setupIdentity of [
    "UPDATE member_accounts SET password_hash='managed:firebase-v1' WHERE member_id=1",
    "INSERT INTO firebase_links(member_id,project_id,firebase_uid) VALUES(1,'koru-951bf','synthetic-uid')",
    "INSERT INTO firebase_sessions VALUES('synthetic-hash',1,1,'koru-951bf','synthetic-uid',1,'synthetic-seal',1,NULL)",
    "INSERT INTO firebase_registrations(id,project_id,email,username,name,expires_at,claim_member_id,claim_version) VALUES('synthetic','koru-951bf','new@example.test','old-claim','Synthetic',1,1,1)",
    "INSERT INTO firebase_registrations(id,project_id,email,username,name,expires_at) VALUES('synthetic','koru-951bf','other@example.test','target','Synthetic',1)",
    "INSERT INTO firebase_registrations(id,project_id,email,username,name,expires_at) VALUES('synthetic','koru-951bf','target@example.test','other','Synthetic',1)",
  ]) {
    const ctx = setup();
    try {
      ctx.root.sql.exec(readFileSync(new URL("../../drizzle/0013_firebase_auth.sql", import.meta.url), "utf8"));
      ctx.root.sql.exec(setupIdentity);
      const dry = await ctx.service.inspect(requestId, { second: 2 });
      assert.ok(dry.plan.blockers.includes("FIREBASE_ERASURE_COORDINATION_REQUIRED"));
      await assert.rejects(ctx.service.execute(requestId, await ctx.approval()), /ERASURE_PLAN_BLOCKED/);
      assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM account_erasure_jobs").get().n, 0);
      assert.equal(ctx.root.sql.prepare("SELECT session_version FROM member_accounts WHERE member_id=1").get().session_version, 1);
      for (const store of [ctx.root, ctx.second, ctx.orphan]) assert.equal(store.sql.prepare("SELECT count(*) AS n FROM photos").get().n, 2);
    } finally { ctx.close(); }
  }
});
test("empty Firebase tables do not block unrelated legacy erasure", async () => {
  const ctx = setup();
  try {
    ctx.root.sql.exec(readFileSync(new URL("../../drizzle/0013_firebase_auth.sql", import.meta.url), "utf8"));
    assert.deepEqual((await ctx.service.inspect(requestId, { second: 2 })).plan.blockers, []);
    assert.equal((await ctx.service.execute(requestId, await ctx.approval())).completed, true);
    assert.deepEqual(ctx.root.sql.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { ctx.close(); }
});
test("resumed erasure refuses Firebase claims created after its persisted dry run", async () => {
  const ctx = setup();
  try {
    ctx.root.sql.exec(readFileSync(new URL("../../drizzle/0013_firebase_auth.sql", import.meta.url), "utf8"));
    const approved = await ctx.approval(), dry = await ctx.service.inspect(requestId, { second: 2 });
    ctx.root.sql.prepare(`INSERT INTO account_erasure_jobs(request_id,account_member_id,plan_json,plan_digest,created_at,updated_at)
      VALUES(?,1,?,?,1,1)`).run(requestId, JSON.stringify(dry.plan), dry.digest);
    ctx.root.sql.exec("INSERT INTO firebase_links(member_id,project_id,firebase_uid) VALUES(1,'koru-951bf','synthetic-uid')");
    await assert.rejects(ctx.service.execute(requestId, approved), /ERASURE_FIREBASE_COORDINATION_REQUIRED/);
    assert.equal(ctx.root.sql.prepare("SELECT frozen_at FROM account_erasure_jobs").get().frozen_at, null);
    assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM photos").get().n, 2);
  } finally { ctx.close(); }
});
test("execution requires stopped writers, reviewed shared content and the exact approved dry-run digest", async () => {
  const ctx = setup();
  try {
    const approved = await ctx.approval();
    for (const change of [{ writersStopped: false }, { contentReviewComplete: false }, { expectedDigest: "wrong" }, { confirmation: "wrong" }]) await assert.rejects(ctx.service.execute(requestId, { ...approved, ...change }), /ERASURE_/);
    assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM account_erasure_jobs").get().n, 0);
    assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM member_accounts").get().n, 3);
    await assert.rejects(ctx.service.inspect("' OR 1=1"), /ERASURE_INVALID_REQUEST/);
    ctx.root.sql.prepare("UPDATE account_deletion_requests SET status='cancelled' WHERE id=?").run(requestId);
    await assert.rejects(ctx.service.execute(requestId, approved), /ERASURE_REQUEST_NOT_ACTIVE/);
  } finally { ctx.close(); }
});
test("last owners and shared photo references block execution before an account is frozen", async () => {
  const ctx = setup();
  try {
    const dry = await ctx.service.inspect(requestId);
    await assert.rejects(ctx.service.execute(requestId, { writersStopped: true, contentReviewComplete: true, expectedDigest: dry.digest, confirmation: dry.plan.confirmation }), /ERASURE_PLAN_BLOCKED/);
    ctx.second.sql.exec("UPDATE members SET avatar_media_key='target-photo' WHERE id=20");
    const shared = await ctx.service.inspect(requestId, { second: 2 });
    assert.ok(shared.plan.blockers.includes("SHARED_MEDIA_REVIEW:second"));
    const approved = await ctx.approval();
    await assert.rejects(ctx.service.execute(requestId, approved), /ERASURE_PLAN_BLOCKED/);
    assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM account_erasure_jobs").get().n, 0);
  } finally { ctx.close(); }
});
test("unknown bindings, wrong group ownership, member-ID confusion and unrelated successor accounts fail closed", async () => {
  const ctx = setup();
  try {
    assert.throws(() => ctx.create(ctx.root.db, { DB: ctx.root.db, SECOND: ctx.root.db }), /ERASURE_BINDING_MISMATCH/);
    const missing = ctx.create(ctx.root.db, { DB: ctx.root.db, GROUP_SECOND: ctx.second.db });
    await assert.rejects(missing.inspect(requestId), /ERASURE_REGISTRY_MISMATCH/);
    for (const id of [1, 3, 20]) await assert.rejects(ctx.service.inspect(requestId, { second: id }), /ERASURE_INVALID_SUCCESSOR/);
    ctx.second.sql.exec("UPDATE group_database_ownership SET group_id='wrong'");
    await assert.rejects(ctx.service.inspect(requestId), /ERASURE_GROUP_OWNERSHIP_MISMATCH/);
    ctx.second.sql.exec("UPDATE group_database_ownership SET group_id='second'");
    ctx.root.sql.exec("UPDATE reading_group_memberships SET member_id=999 WHERE account_member_id=1 AND group_id='second'");
    await assert.rejects(ctx.service.inspect(requestId), /ERASURE_MEMBER_MAPPING_MISMATCH/);
  } finally { ctx.close(); }
});
test("erasure removes direct personal records/media across all mappings, preserves other users and shared FK rows, and is idempotent", async () => {
  const ctx = setup();
  try {
    const approved = await ctx.approval();
    assert.deepEqual(await ctx.service.execute(requestId, approved), { completed: true, alreadyCompleted: false });
    for (const [binding, target, other] of [["DB", 1, 2], ["GROUP_SECOND", 10, 20], ["GROUP_ORPHAN", 10, 20]]) {
      const sql = ctx.stores[binding].sql;
      for (const table of personalTables) {
        assert.equal(sql.prepare(`SELECT count(*) AS n FROM ${table} WHERE member_id=?`).get(target).n, 0);
        assert.equal(sql.prepare(`SELECT count(*) AS n FROM ${table} WHERE member_id=?`).get(other).n, 1);
      }
      assert.equal(sql.prepare("SELECT count(*) AS n FROM media").get().n, 1);
      assert.equal(sql.prepare("SELECT media_key FROM media").get().media_key, "other-photo");
      assert.equal(sql.prepare("SELECT count(*) AS n FROM photos WHERE uploaded_by=?").get(target).n, 0);
      const row = sql.prepare("SELECT name,avatar_media_key,face_reference_media_key,is_guest FROM members WHERE id=?").get(target);
      assert.deepEqual({ ...row }, { name: "Silinen hesap", avatar_media_key: null, face_reference_media_key: null, is_guest: 1 });
      assert.equal(sql.prepare("SELECT count(*) AS n FROM meetings").get().n, 1);
      assert.equal(sql.prepare("SELECT count(*) AS n FROM roadmap").get().n, 1);
      assert.deepEqual(sql.prepare("PRAGMA foreign_key_check").all(), []);
    }
    assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM member_accounts WHERE member_id=1").get().n, 0);
    assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM account_profiles WHERE member_id=1").get().n, 0);
    for (const table of ["account_recovery_tokens", "account_email_verifications", "pending_registrations", "account_deletion_requests", "account_experience"]) assert.equal(ctx.root.sql.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
    assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM reading_group_memberships WHERE account_member_id=1").get().n, 0);
    assert.equal(ctx.root.sql.prepare("SELECT owner_id FROM group_provisioning WHERE group_id='second'").get().owner_id, 2);
    assert.equal(ctx.second.sql.prepare("SELECT role FROM members WHERE id=20").get().role, "super_admin");
    assert.ok(ctx.root.sql.prepare("SELECT revoked_at FROM group_invitations").get().revoked_at);
    assert.equal(ctx.root.sql.prepare("SELECT account_member_id FROM group_invitation_redemptions").get().account_member_id, 3);
    assert.doesNotMatch(JSON.stringify(ctx.root.sql.prepare("SELECT * FROM account_erasure_jobs").all()), /target@example|Target Name|password_hash|Synthetic private/);
    assert.deepEqual(await ctx.service.execute(requestId, approved), { completed: true, alreadyCompleted: true });
    const accounts = ctx.load("db/accounts");
    assert.equal(await accounts.authenticateAccount("target", password), null);
    assert.equal(await accounts.sessionAccountIsCurrent({ memberId: 1, sessionVersion: 0 }), false);
    assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM member_accounts WHERE member_id=1").get().n, 0);
  } finally { ctx.close(); }
});
test("a failed group transaction leaves an account frozen and retry resumes after completed databases", async () => {
  const ctx = setup();
  try {
    const approved = await ctx.approval();
    let once = true;
    ctx.second.hooks.beforeBatch = () => { if (once) { once = false; throw new Error("Synthetic group failure"); } };
    await assert.rejects(ctx.service.execute(requestId, approved), /Synthetic group failure/);
    assert.equal(ctx.root.sql.prepare("SELECT status FROM account_deletion_requests").get().status, "processing");
    assert.equal(ctx.root.sql.prepare("SELECT lease_token FROM account_erasure_jobs").get().lease_token, null);
    assert.deepEqual(JSON.parse(ctx.root.sql.prepare("SELECT completed_bindings FROM account_erasure_jobs").get().completed_bindings), ["DB", "GROUP_ORPHAN"]);
    assert.equal(await ctx.load("db/accounts").authenticateAccount("target", password), null);
    assert.equal(await ctx.load("db/accounts").sessionAccountIsCurrent({ memberId: 1, sessionVersion: 1 }), false);
    assert.equal(ctx.second.sql.prepare("SELECT count(*) AS n FROM reviews WHERE member_id=10").get().n, 1);
    assert.equal((await ctx.service.execute(requestId, approved)).completed, true);
    assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM member_accounts WHERE member_id=2").get().n, 1);
  } finally { ctx.close(); }
});
test("a lost canonical checkpoint retries an already committed group purge safely", async () => {
  const ctx = setup();
  try {
    const approved = await ctx.approval();
    let checkpoints = 0;
    ctx.root.hooks.beforeRun = (statement) => { if (statement.startsWith("UPDATE account_erasure_jobs SET completed_bindings") && ++checkpoints === 3) throw new Error("Synthetic checkpoint failure"); };
    await assert.rejects(ctx.service.execute(requestId, approved), /Synthetic checkpoint failure/);
    assert.equal(ctx.second.sql.prepare("SELECT count(*) AS n FROM media").get().n, 1);
    assert.equal((await ctx.service.execute(requestId, approved)).completed, true);
    assert.deepEqual(ctx.root.sql.prepare("PRAGMA foreign_key_check").all(), []);
  } finally { ctx.close(); }
});
test("an error inside a group transaction rolls back its deleted rows and media", async () => {
  const ctx = setup();
  try {
    const approved = await ctx.approval();
    ctx.second.sql.exec("CREATE TRIGGER erasure_fixture_failure BEFORE UPDATE ON members WHEN NEW.name='Silinen hesap' BEGIN SELECT RAISE(ABORT,'fixture transaction failure'); END");
    await assert.rejects(ctx.service.execute(requestId, approved), /fixture transaction failure/);
    assert.equal(ctx.second.sql.prepare("SELECT count(*) AS n FROM media").get().n, 4);
    assert.equal(ctx.second.sql.prepare("SELECT count(*) AS n FROM reviews WHERE member_id=10").get().n, 1);
    assert.equal(ctx.second.sql.prepare("SELECT role FROM members WHERE id=20").get().role, "admin");
    ctx.second.sql.exec("DROP TRIGGER erasure_fixture_failure");
    assert.equal((await ctx.service.execute(requestId, approved)).completed, true);
  } finally { ctx.close(); }
});
test("canonical finalization failure rolls back identity deletion and can be resumed", async () => {
  const ctx = setup();
  try {
    const approved = await ctx.approval();
    ctx.root.sql.exec("CREATE TRIGGER erasure_fixture_final BEFORE DELETE ON member_accounts WHEN OLD.member_id=1 BEGIN SELECT RAISE(ABORT,'fixture finalization failure'); END");
    await assert.rejects(ctx.service.execute(requestId, approved), /fixture finalization failure/);
    assert.equal(ctx.root.sql.prepare("SELECT status FROM account_deletion_requests WHERE member_id=1").get().status, "processing");
    assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM account_profiles WHERE member_id=1").get().n, 1);
    assert.equal(ctx.root.sql.prepare("SELECT completed_at FROM account_erasure_jobs").get().completed_at, null);
    ctx.root.sql.exec("DROP TRIGGER erasure_fixture_final");
    assert.equal((await ctx.service.execute(requestId, approved)).completed, true);
  } finally { ctx.close(); }
});
test("an unfinished erasure prevents another account job from starting or stealing the operator lease", async () => {
  const ctx = setup();
  try {
    const approved = await ctx.approval();
    ctx.second.hooks.beforeBatch = () => { throw new Error("Synthetic pause"); };
    await assert.rejects(ctx.service.execute(requestId, approved), /Synthetic pause/);
    const secondId = "44444444-4444-4444-8444-444444444444";
    ctx.root.sql.prepare("INSERT INTO account_deletion_requests(id,member_id,requested_at,updated_at) VALUES(?,3,1,1)").run(secondId);
    const inspected = await ctx.service.inspect(secondId);
    await assert.rejects(ctx.service.execute(secondId, { ...approved, expectedDigest: inspected.digest, confirmation: inspected.plan.confirmation, transfers: {} }), /ERASURE_BUSY/);
    assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM account_erasure_jobs").get().n, 1);
    ctx.root.sql.exec("UPDATE account_erasure_jobs SET lease_token='other-operator'");
    await assert.rejects(ctx.service.execute(requestId, approved), /ERASURE_BUSY/);
    assert.equal(ctx.root.sql.prepare("SELECT lease_token FROM account_erasure_jobs").get().lease_token, "other-operator");
  } finally { ctx.close(); }
});
test("a retained erasure ledger blocks login and old sessions even if account rows are accidentally restored", async () => {
  const ctx = setup();
  try {
    await ctx.service.execute(requestId, await ctx.approval());
    ctx.root.sql.prepare("INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations) VALUES(1,'target',?,?,100000)").run(passwordHash, salt);
    const accounts = ctx.load("db/accounts");
    assert.equal(await accounts.authenticateAccount("target", password), null);
    assert.equal(await accounts.sessionAccountIsCurrent({ memberId: 1, sessionVersion: 1 }), false);
    assert.equal((await accounts.changeMemberPassword(1, password, "Another-Synthetic-48296")).ok, false);
    ctx.root.sql.exec("INSERT INTO account_profiles VALUES(1,'target@example.test',1,'fixture')");
    const token = "a".repeat(64);
    const tokenHash = await ctx.load("lib/onboarding-policy").tokenHash(token);
    ctx.root.sql.prepare("INSERT INTO account_recovery_tokens VALUES(?,1,1,?,NULL)").run(tokenHash, Date.now() + 100000);
    const onboarding = ctx.load("db/onboarding-accounts");
    assert.equal((await onboarding.requestRecovery(new Request("https://app.example.com/api/onboarding/forgot-password"), "target@example.test")).ok, true);
    assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM account_recovery_tokens").get().n, 1);
    await assert.rejects(onboarding.resetAccountPassword(token, "Another-Synthetic-48296"), /geçersiz/);
  } finally { ctx.close(); }
});

test("corrupt persisted plans and checkpoints fail closed before erasure can resume", async () => {
  for (const corruption of ["json", "digest", "checkpoints", "account"]) {
    const ctx = setup();
    try {
      const approved = await ctx.approval();
      ctx.second.hooks.beforeBatch = () => { throw Error("Synthetic stop"); };
      await assert.rejects(ctx.service.execute(requestId, approved), /Synthetic stop/);
      if (corruption === "json") ctx.root.sql.exec("UPDATE account_erasure_jobs SET plan_json='null'");
      if (corruption === "digest") ctx.root.sql.exec("UPDATE account_erasure_jobs SET plan_digest='0000000000000000000000000000000000000000000000000000000000000000'");
      if (corruption === "checkpoints") ctx.root.sql.exec(`UPDATE account_erasure_jobs SET completed_bindings='["UNKNOWN"]'`);
      if (corruption === "account") ctx.root.sql.exec("UPDATE account_erasure_jobs SET account_member_id=3");
      ctx.second.hooks.beforeBatch = () => {};
      await assert.rejects(ctx.service.execute(requestId, approved), /ERASURE_JOURNAL_INVALID/);
      assert.equal(ctx.root.sql.prepare("SELECT count(*) AS n FROM member_accounts").get().n, 3);
    } finally { ctx.close(); }
  }
});

test("the same erasure transactions execute against real local workerd D1 databases", async () => {
  const { Miniflare } = createRequire(require.resolve("wrangler/package.json"))("miniflare");
  const ctx = setup();
  const worker = new Miniflare({ modules: true, compatibilityDate: "2026-05-15", script: "export default { fetch() { return new Response('Synthetic D1 fixture'); } }",
    d1Databases: Object.fromEntries(Object.keys(ctx.stores).map((name, index) => [name, `erasure-fixture-${index}`])) });
  try {
    const bindings = {};
    for (const [name, source] of Object.entries(ctx.stores)) {
      const target = bindings[name] = await worker.getD1Database(name);
      const migrations = ["0000_strange_eternals", "0001_store_media_in_d1", "0002_member_accounts", "0003_member_profiles_and_reading_progress", "0004_face_recognition", "0005_club_tools", "0006_super_admin_roles", "0007_meeting_rsvps", "0010_group_account_links"];
      if (name === "DB") migrations.push("0008_reading_groups", "0009_self_service", "0011_account_experience", "0012_account_erasure_jobs");
      for (const file of migrations) {
        const sql = readFileSync(new URL(`../../drizzle/${file}.sql`, import.meta.url), "utf8");
        for (const statement of sql.split("--> statement-breakpoint").filter((part) => part.trim())) await target.prepare(statement.trim()).run();
      }
      const ordered = ["members", "books", "meetings", "roadmap", "media", "attendance", "meeting_rsvps", "reviews", "photos", "favorite_books", "book_votes", "member_accounts", "reading_groups", "reading_group_memberships", "account_profiles", "account_experience", "account_deletion_requests", "pending_registrations", "account_recovery_tokens", "account_email_verifications", "group_provisioning", "group_invitations", "group_invitation_redemptions", "group_account_links", "group_database_ownership"];
      const available = new Set(source.sql.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name));
      for (const table of ordered.filter((table) => available.has(table))) {
        for (const row of source.sql.prepare(`SELECT * FROM ${table}`).all()) {
          if (table === "reading_groups" && row.id === "default") continue;
          const columns = Object.keys(row);
          const values = Object.values(row).map((value) => value instanceof Uint8Array ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) : value);
          await target.prepare(`INSERT INTO ${table}(${columns.join(",")}) VALUES(${columns.map(() => "?").join(",")})`).bind(...values).run();
        }
      }
    }
    const service = ctx.create(bindings.DB, bindings);
    const transfers = { second: 2 };
    const inspected = await service.inspect(requestId, transfers);
    assert.deepEqual(inspected.plan.blockers, []);
    const result = await service.execute(requestId, { writersStopped: true, contentReviewComplete: true, transfers, expectedDigest: inspected.digest, confirmation: inspected.plan.confirmation });
    assert.equal(result.completed, true);
    assert.equal((await bindings.DB.prepare("SELECT count(*) AS n FROM member_accounts WHERE member_id=1").first()).n, 0);
    for (const [name, db] of Object.entries(bindings)) {
      if (name === "GROUP_EMPTY") continue;
      assert.equal((await db.prepare("SELECT count(*) AS n FROM media").first()).n, 1);
      assert.deepEqual((await db.prepare("PRAGMA foreign_key_check").all()).results, []);
    }
  } finally { await worker.dispose(); ctx.close(); }
});
