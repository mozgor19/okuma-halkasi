import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";
import { requireLocalEmulator } from "./emulator-only.mjs";
import { linkedIdentity, signedTokenVerifier } from "./identity-contract.mjs";

const { projectId, host } = requireLocalEmulator();
const { initializeApp: initializeAdmin, deleteApp: deleteAdmin } = await import("firebase-admin/app");
const { getAuth } = await import("firebase-admin/auth");
const { initializeApp, deleteApp } = await import("firebase/app");
const client = await import("firebase/auth");
const adminApp = initializeAdmin({ projectId }, "koru-local-prototype");
const admin = getAuth(adminApp);
const app = initializeApp({ projectId, apiKey: "synthetic-emulator-key", authDomain: `${projectId}.firebaseapp.com` }, "koru-local-prototype");
const auth = client.initializeAuth(app, { persistence: client.inMemoryPersistence });
client.connectAuthEmulator(auth, `http://${host}`, { disableWarnings: true });
const sql = new DatabaseSync(":memory:");
sql.exec(`PRAGMA foreign_keys=ON;
  CREATE TABLE account_links(project TEXT, uid TEXT, account_id INTEGER UNIQUE, session_version INTEGER DEFAULT 1,
    valid_after INTEGER DEFAULT 0, disabled INTEGER DEFAULT 0, erasure_blocked INTEGER DEFAULT 0, PRIMARY KEY(project, uid));
  CREATE TABLE memberships(account_id INTEGER, group_id TEXT, local_member_id INTEGER, role TEXT, scheme TEXT,
    PRIMARY KEY(account_id, group_id));`);
const store = { byUid(project, uid) {
  const row = sql.prepare("SELECT * FROM account_links WHERE project = ? AND uid = ?").get(project, uid);
  return row && { accountId: row.account_id, sessionVersion: row.session_version, validAfter: row.valid_after,
    disabled: !!row.disabled, erasureBlocked: !!row.erasure_blocked };
} };
let checks = 0;
test("official Firebase Auth emulator: synthetic account lifecycle and canonical-link contract", async (t) => {
  const email = "synthetic-account@example.invalid";
  const password = "Synthetic-Only-Password-2026";
  let uid, initialToken;
  async function check(name, fn) { await t.test(name, async () => { await fn(); checks++; }); }
  async function identity(token) {
    const decoded = await admin.verifyIdToken(token, true);
    if (decoded.email_verified !== true || decoded.firebase.sign_in_provider !== "password") throw Error("UNVERIFIED_IDENTITY");
    return { uid: decoded.uid, authTime: decoded.auth_time };
  }
  try {
    await check("registration remains untrusted until email confirmation", async () => {
      const credential = await client.createUserWithEmailAndPassword(auth, email, password);
      uid = credential.user.uid;
      await assert.rejects(identity(await credential.user.getIdToken()), /UNVERIFIED/);
    });
    await check("verification action is delivered only to local emulator outbox and consumed by official SDK", async () => {
      await client.sendEmailVerification(auth.currentUser);
      const response = await fetch(`http://${host}/emulator/v1/projects/${projectId}/oobCodes`);
      assert.equal(response.status, 200);
      const code = (await response.json()).oobCodes.findLast((entry) => entry.requestType === "VERIFY_EMAIL" && entry.email === email)?.oobCode;
      assert.ok(code);
      await client.applyActionCode(auth, code);
      await client.reload(auth.currentUser);
      initialToken = await auth.currentUser.getIdToken(true);
      assert.equal((await identity(initialToken)).uid, uid);
    });
    await check("an emulator token cannot enter the signed Workers-verifier candidate", async () => {
      await assert.rejects(signedTokenVerifier(projectId)(initialToken));
    });
    await check("verified Firebase account cannot claim an unlinked D1 identity by matching email", async () => {
      assert.throws(() => linkedIdentity(store, projectId, { uid, authTime: Math.floor(Date.now() / 1000), email }));
      sql.prepare("INSERT INTO account_links(project, uid, account_id) VALUES(?, ?, ?)").run(projectId, uid, 41);
      assert.deepEqual(linkedIdentity(store, projectId, await identity(initialToken)), { accountId: 41, sessionVersion: 1 });
    });
    await check("group-local IDs, roles and appearance remain canonical membership data, not token claims", () => {
      sql.prepare("INSERT INTO memberships VALUES(?, ?, ?, ?, ?)").run(41, "first", 7, "member", "notebook");
      sql.prepare("INSERT INTO memberships VALUES(?, ?, ?, ?, ?)").run(41, "second", 19, "super_admin", "minimal");
      const rows = sql.prepare("SELECT * FROM memberships WHERE account_id = ? ORDER BY group_id").all(41);
      assert.equal(rows.length, 2);
      assert.equal(rows[0].local_member_id, 7);
      assert.equal(rows[1].local_member_id, 19);
      assert.equal(rows[1].scheme, "minimal");
      assert.equal(rows[0].role, "member");
    });
    await check("wrong password is rejected by the real Auth emulator", async () => {
      await client.signOut(auth);
      await assert.rejects(client.signInWithEmailAndPassword(auth, email, "Wrong-Synthetic-Password"));
      await client.signInWithEmailAndPassword(auth, email, password);
    });
    await check("password reset works with SDK and old password is rejected", async () => {
      await client.sendPasswordResetEmail(auth, email);
      const response = await fetch(`http://${host}/emulator/v1/projects/${projectId}/oobCodes`);
      const code = (await response.json()).oobCodes.findLast((entry) => entry.requestType === "PASSWORD_RESET" && entry.email === email)?.oobCode;
      assert.ok(code);
      const next = "Changed-Synthetic-Password-2026";
      await client.confirmPasswordReset(auth, code, next);
      await assert.rejects(client.confirmPasswordReset(auth, code, next));
      await client.signOut(auth);
      await assert.rejects(client.signInWithEmailAndPassword(auth, email, password));
      await client.signInWithEmailAndPassword(auth, email, next);
    });
    await check("recent authentication and canonical invalidation deny stale identities", () => {
      const now = Math.floor(Date.now() / 1000);
      assert.throws(() => linkedIdentity(store, projectId, { uid, authTime: now - 301 }, { requireRecent: true }));
      sql.prepare("UPDATE account_links SET valid_after = ?, session_version = session_version + 1 WHERE account_id = ?").run(now + 1, 41);
      assert.throws(() => linkedIdentity(store, projectId, { uid, authTime: now }));
      sql.prepare("UPDATE account_links SET valid_after = 0 WHERE account_id = 41").run();
    });
    await check("admin revocation rejects old tokens with real checkRevoked, not only signature verification", async () => {
      const decoded = await admin.verifyIdToken(await auth.currentUser.getIdToken());
      const oldToken = await auth.currentUser.getIdToken();
      while (Math.floor(Date.now() / 1000) <= decoded.auth_time) await new Promise((resolve) => setTimeout(resolve, 100));
      await admin.revokeRefreshTokens(uid);
      await assert.rejects(admin.verifyIdToken(oldToken, true), (error) => error.code === "auth/id-token-revoked");
    });
    await check("D1 erasure freeze denies access even for a provider-valid restored identity", () => {
      sql.prepare("UPDATE account_links SET erasure_blocked = 1 WHERE account_id = 41").run();
      assert.throws(() => linkedIdentity(store, projectId, { uid, authTime: Math.floor(Date.now() / 1000) }));
    });
    await check("provider deletion prevents sign-in; no duplicate or replacement D1 account is created", async () => {
      await admin.deleteUser(uid);
      await client.signOut(auth);
      await assert.rejects(client.signInWithEmailAndPassword(auth, email, "Changed-Synthetic-Password-2026"));
      assert.equal(sql.prepare("SELECT count(*) AS n FROM account_links").get().n, 1);
      assert.equal(sql.prepare("SELECT count(*) AS n FROM memberships").get().n, 2);
    });
    assert.equal(checks, 11, "Every emulator check must pass before writing successful evidence");
    await fs.writeFile(process.env.KORU_FIREBASE_REPORT, JSON.stringify({
      status: "passed", scope: "local-synthetic-auth-emulator-only", checkedAt: new Date().toISOString(),
      projectId, checks, remoteAccountsTouched: false, paidServicesOpened: false,
      passwordHashImportVerified: false, realEmailDeliveryVerified: false, workersRuntimeVerified: false,
    }, null, 2), { mode: 0o600 });
  } finally {
    await client.signOut(auth);
    await deleteApp(app);
    await deleteAdmin(adminApp);
    sql.close();
  }
});
