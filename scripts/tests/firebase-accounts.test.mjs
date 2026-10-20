import assert from "node:assert/strict";
import test from "node:test";
import { firebaseAccountFixture, oldPassword, newPassword } from "../fixtures/firebase-account-test.mjs";

test("registration claim constraints reject half-present or invalid legacy proofs", () => {
  const f = firebaseAccountFixture();
  try {
    f.legacy();
    const insert = f.sql.prepare("INSERT INTO firebase_registrations(id,project_id,email,username,name,expires_at,claim_member_id,claim_version) VALUES('synthetic','koru-951bf','claim@example.test','claim','Synthetic',1,?,?)");
    for (const [memberId, version] of [[1, null], [null, 1], [1, -1], [0, 1]]) assert.throws(() => insert.run(memberId, version), /constraint failed/);
    insert.run(1, 1);
  } finally { f.close(); }
});

test("production signup stores no password, requires provider verification, and creates an isolated passwordless canonical identity", async () => {
  const f = firebaseAccountFixture();
  try {
    const { user } = await f.register(), accounts = f.load("db/firebase-accounts");
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM member_accounts").get().n, 0);
    assert.equal(await accounts.authenticateFirebaseAccount("new.reader", newPassword), null);
    assert.equal(f.messages.length, 1); assert.equal(f.messages[0].continueUrl, "https://birkoru.com/login");
    const result = await accounts.firebaseEmailAction({ mode: "verifyEmail", code: f.messages[0].code }); assert.equal(result.ok, true);
    const signed = await accounts.authenticateFirebaseAccount("new.reader", newPassword); assert.ok(signed); assert.equal(signed.firebase.uid, user.uid);
    const row = f.sql.prepare("SELECT * FROM member_accounts").get(); assert.equal(row.password_hash, "managed:firebase-v1"); assert.equal(row.password_iterations, 0); assert.equal(row.password_salt, "");
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM reading_group_memberships").get().n, 0);
    assert.doesNotMatch(JSON.stringify(f.sql.prepare("SELECT * FROM firebase_registrations").all()), new RegExp(newPassword));
    const handle = await accounts.createFirebaseSession(signed.memberId, signed.sessionVersion, signed.firebase); assert.match(handle, /^fb2\.[a-f0-9]{64}$/);
    const stored = f.sql.prepare("SELECT * FROM firebase_sessions").get(); assert.notEqual(stored.token_hash, handle.slice(4)); assert.doesNotMatch(stored.sealed_credentials, /synthetic-refresh|new@example|unit-double/);
    assert.deepEqual(await accounts.firebaseSessionIdentity(handle), { memberId: signed.memberId, sessionVersion: signed.sessionVersion, firebase: true });
    await accounts.revokeFirebaseSession(handle); assert.equal(await accounts.firebaseSessionIdentity(handle), null);
    assert.equal(f.sql.prepare("SELECT sealed_credentials FROM firebase_sessions").get().sealed_credentials, "");
    await assert.rejects(accounts.firebaseEmailAction({ mode: "verifyEmail", code: f.messages[0].code }), (error) => error.code === "INVALID_TOKEN");
  } finally { f.close(); }
});

test("existing provider email and ambiguous orphan creation are never adopted as a new Koru identity", async () => {
  for (const orphan of [false, true]) {
    const f = firebaseAccountFixture();
    try {
      if (!orphan) f.user("new@example.test"); else f.hooks.failAfterSignup = true;
      await f.register();
      f.hooks.failAfterSignup = false;
      await f.register();
      assert.equal(f.sql.prepare("SELECT count(*) AS n FROM firebase_links").get().n, 0);
      assert.equal(f.sql.prepare("SELECT count(*) AS n FROM member_accounts").get().n, 0);
      assert.equal(await f.load("db/firebase-accounts").authenticateFirebaseAccount("new.reader", newPassword), null);
    } finally { f.close(); }
  }
});

test("legacy claim proves old password and verified new UID, retains IDs/roles/groups/appearance, and revokes old sessions", async () => {
  const f = firebaseAccountFixture();
  try {
    const legacy = f.legacy(), accounts = f.load("db/accounts"), firebase = f.load("db/firebase-accounts"), auth = f.load("lib/auth");
    const before = f.sql.prepare("SELECT * FROM reading_group_memberships").all();
    const token = await auth.createSessionToken(legacy.id, 1);
    assert.ok(await accounts.authenticateAccount(legacy.username, oldPassword));
    assert.equal(await accounts.sessionAccountIsCurrent(await auth.sessionIdentity(token)), true);
    const body = { email: "claim@example.test", password: oldPassword, newPassword, acceptedPolicy: true };
    await assert.rejects(firebase.linkFirebaseAccount(f.request, legacy.id, { ...body, password: "Wrong-Password-7284" }), (error) => error.code === "INVALID_PASSWORD");
    assert.equal(f.users.size, 0);
    await firebase.linkFirebaseAccount(f.request, legacy.id, body);
    assert.equal(f.sql.prepare("SELECT password_hash FROM member_accounts").get().password_hash, legacy.hash);
    assert.equal(await firebase.authenticateFirebaseAccount(legacy.username, newPassword), null);
    assert.ok(await accounts.authenticateAccount(legacy.username, oldPassword));
    await firebase.firebaseEmailAction({ mode: "verifyEmail", code: f.messages[0].code });
    const signed = await accounts.authenticateAccount(legacy.username, newPassword); assert.equal(signed.memberId, legacy.id); assert.equal(signed.sessionVersion, 2);
    assert.equal(await accounts.authenticateAccount(legacy.username, oldPassword), null);
    assert.equal(await accounts.sessionAccountIsCurrent(await auth.sessionIdentity(token)), false);
    assert.deepEqual(f.sql.prepare("SELECT * FROM reading_group_memberships").all(), before);
    assert.equal(f.sql.prepare("SELECT role FROM members WHERE id=?").get(legacy.id).role, "super_admin");
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM members").get().n, 1);
    f.env.AUTH_PROVIDER = undefined;
    f.env.MEMBER_CREDENTIALS = JSON.stringify({ [legacy.username]: { memberId: legacy.id, password: oldPassword } });
    assert.equal(await accounts.authenticateAccount(legacy.username, oldPassword), null);
    assert.equal(await accounts.sessionAccountIsCurrent({ memberId: legacy.id, sessionVersion: 2 }), false);
  } finally { f.close(); }
});

test("stale legacy proof cannot link an account after its session version changes", async () => {
  const f = firebaseAccountFixture();
  try {
    const legacy = f.legacy(), firebase = f.load("db/firebase-accounts");
    await firebase.linkFirebaseAccount(f.request, legacy.id, { email: "claim@example.test", password: oldPassword, newPassword, acceptedPolicy: true });
    f.sql.exec("UPDATE member_accounts SET session_version=session_version+1");
    await firebase.firebaseEmailAction({ mode: "verifyEmail", code: f.messages[0].code });
    assert.equal(await firebase.authenticateFirebaseAccount(legacy.username, newPassword), null);
    assert.equal(f.sql.prepare("SELECT count(*) AS n FROM firebase_links").get().n, 0);
    assert.equal(f.sql.prepare("SELECT password_hash FROM member_accounts").get().password_hash, legacy.hash);
  } finally { f.close(); }
});

test("password change uncertainty freezes sessions; fresh provider proof can reconcile only an advanced revocation boundary", async () => {
  const f = firebaseAccountFixture();
  try {
    const { user } = await f.register(), firebase = f.load("db/firebase-accounts"); user.verified = true;
    const signed = await firebase.authenticateFirebaseAccount("new.reader", newPassword), handle = await firebase.createFirebaseSession(signed.memberId, signed.sessionVersion, signed.firebase);
    const nextPassword = "Third-Synthetic-Password-3849";
    f.hooks.failAfterPassword = true;
    await assert.rejects(firebase.changeFirebasePassword(signed.memberId, newPassword, nextPassword), (error) => error.status === 503);
    assert.equal(f.sql.prepare("SELECT mutation_pending FROM firebase_links").get().mutation_pending, 1);
    assert.equal(await firebase.firebaseSessionIdentity(handle), null);
    assert.equal(await firebase.authenticateFirebaseAccount("new.reader", newPassword), null);
    f.hooks.failAfterPassword = false;
    const recovered = await firebase.authenticateFirebaseAccount("new.reader", nextPassword); assert.equal(recovered.sessionVersion, 2);
    assert.equal(f.sql.prepare("SELECT mutation_pending FROM firebase_links").get().mutation_pending, 0);
    assert.equal(await firebase.firebaseSessionIdentity(handle), null);
    const changed = await firebase.changeFirebasePassword(signed.memberId, nextPassword, "Fourth-Synthetic-Password-3748"); assert.equal(changed.ok, true); assert.equal(changed.sessionVersion, 3);
  } finally { f.close(); }
});

test("ambiguous canonical mutation commit leaves the identity frozen until provider proof is reconciled", async () => {
  const f = firebaseAccountFixture();
  try {
    const { user } = await f.register(), firebase = f.load("db/firebase-accounts"); user.verified = true;
    const signed = await firebase.authenticateFirebaseAccount("new.reader", newPassword);
    f.hooks.failBatch = true;
    await assert.rejects(firebase.changeFirebasePassword(signed.memberId, newPassword, "Third-Synthetic-Password-3849"), (error) => error.status === 503);
    assert.equal(f.sql.prepare("SELECT mutation_pending FROM firebase_links").get().mutation_pending, 1);
    f.hooks.failBatch = false;
    assert.ok(await firebase.authenticateFirebaseAccount("new.reader", "Third-Synthetic-Password-3849"));
  } finally { f.close(); }
});

test("real-provider reset protocol enforces password policy, consumes once and revokes every prior Koru handle", async () => {
  const f = firebaseAccountFixture();
  try {
    const { user } = await f.register(), firebase = f.load("db/firebase-accounts"); user.verified = true;
    const signed = await firebase.authenticateFirebaseAccount("new.reader", newPassword), handle = await firebase.createFirebaseSession(signed.memberId, signed.sessionVersion, signed.firebase);
    await firebase.recoverFirebaseAccount(f.request, "new@example.test"); await f.flush(); const code = f.messages.at(-1).code;
    await assert.rejects(firebase.firebaseEmailAction({ mode: "resetPassword", code, password: "short" }), (error) => error.code === "INVALID_PASSWORD");
    assert.equal(f.sql.prepare("SELECT mutation_pending FROM firebase_links").get().mutation_pending, 0);
    const result = await firebase.firebaseEmailAction({ mode: "resetPassword", code, password: "Reset-Synthetic-Password-9847" }); assert.equal(result.ok, true);
    assert.equal(await firebase.firebaseSessionIdentity(handle), null);
    assert.equal(await firebase.authenticateFirebaseAccount("new.reader", newPassword), null);
    assert.ok(await firebase.authenticateFirebaseAccount("new.reader", "Reset-Synthetic-Password-9847"));
    await assert.rejects(firebase.firebaseEmailAction({ mode: "resetPassword", code, password: "Reset-Synthetic-Password-9847" }), (error) => error.code === "INVALID_TOKEN");
  } finally { f.close(); }
});

test("public registration returns before identity lookups or provider work, without account-specific failure responses", async () => {
  let response;
  for (const state of ["new", "existing", "unavailable", "ambiguous"]) {
    const f = firebaseAccountFixture();
    try {
      if (state === "existing") f.legacy(1, "new.reader");
      f.hooks.unavailable = state === "unavailable";
      f.hooks.failAfterSignup = state === "ambiguous";
      const result = await f.load("db/firebase-accounts").registerFirebaseAccount(f.request, f.registration());
      if (response) assert.deepEqual(result, response); else response = result;
      assert.equal(f.tasks.length, 1); assert.deepEqual(f.calls, []);
      assert.equal(f.sql.prepare("SELECT count(*) AS n FROM firebase_registrations").get().n, 0);
      await f.flush();
      assert.equal(f.calls.filter((call) => call === "signUp").length, state === "existing" ? 0 : 1);
      assert.equal(f.messages.length, state === "new" ? 1 : 0);
      if (["unavailable", "ambiguous"].includes(state)) assert.deepEqual(f.diagnostics, [["Firebase registration task failed"]]);
      assert.equal(f.tasks.length, 0);
    } finally { f.close(); }
  }
});

test("recovery hides provider latency and failures for known, unknown and erased accounts without mail retries", async () => {
  let response;
  for (const state of ["known", "unknown", "unavailable", "erasure"]) {
    const f = firebaseAccountFixture();
    try {
      const { user } = await f.register(), firebase = f.load("db/firebase-accounts"); user.verified = true;
      await firebase.authenticateFirebaseAccount("new.reader", newPassword);
      f.messages.length = 0; f.calls.length = 0;
      if (state === "erasure") f.sql.exec("UPDATE firebase_links SET mutation_pending=1,mutation_kind='erasure'");
      f.hooks.unavailable = state === "unavailable";
      const result = await firebase.recoverFirebaseAccount(f.request, state === "unknown" ? "unknown@example.test" : user.email);
      if (response) assert.deepEqual(result, response); else response = result;
      assert.equal(f.tasks.length, 1); assert.deepEqual(f.calls, []); assert.deepEqual(f.messages, []);
      await f.flush();
      assert.equal(f.messages.length, state === "known" ? 1 : 0);
      assert.equal(f.calls.filter((call) => call === "sendOobCode").length, ["known", "unavailable"].includes(state) ? 1 : 0);
      if (state === "unavailable") assert.deepEqual(f.diagnostics, [["Firebase recovery task failed"]]);
    } finally { f.close(); }
  }
});

test("invalid registration or recovery input is rejected before background work or provider calls", async () => {
  const f = firebaseAccountFixture();
  try {
    const firebase = f.load("db/firebase-accounts");
    for (const patch of [{ password: "short" }, { email: "invalid" }, { acceptedPolicy: false }]) {
      await assert.rejects(firebase.registerFirebaseAccount(f.request, f.registration(patch)), (error) => error.status === 400);
    }
    await assert.rejects(firebase.recoverFirebaseAccount(f.request, "invalid"), (error) => error.code === "INVALID_EMAIL");
    assert.equal(f.tasks.length, 0); assert.deepEqual(f.calls, []);
  } finally { f.close(); }
});

test("provider outage, disabled/deleted users and substituted encrypted sessions never fall back to legacy access", async () => {
  const f = firebaseAccountFixture();
  try {
    const { user } = await f.register(), firebase = f.load("db/firebase-accounts"); user.verified = true;
    const signed = await firebase.authenticateFirebaseAccount("new.reader", newPassword), handle = await firebase.createFirebaseSession(signed.memberId, signed.sessionVersion, signed.firebase);
    f.hooks.unavailable = true; await assert.rejects(firebase.firebaseSessionIdentity(handle), (error) => error.status === 503);
    f.hooks.unavailable = false; user.disabled = true; assert.equal(await firebase.firebaseSessionIdentity(handle), null);
    user.disabled = false; f.sql.exec("UPDATE firebase_sessions SET auth_time=auth_time+1"); assert.equal(await firebase.firebaseSessionIdentity(handle), null);
    f.users.delete(user.email); assert.equal(await firebase.authenticateFirebaseAccount("new.reader", newPassword), null);
  } finally { f.close(); }
});
