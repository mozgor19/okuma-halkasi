import { identityDatabase } from "@/db/database";
import { accountErasureBlocked } from "@/db/account-erasure-state";
import { ReadingGroupError } from "@/lib/groups";
import { SESSION_MAX_AGE, type SessionIdentity } from "@/lib/auth";
import { deliverAccountMail } from "@/lib/account-mail";
import { normalizeUsername, passwordValidationIssue } from "@/lib/password";
import { cleanName, newToken, normalizeEmail, POLICY_VERSION, TOKEN_PATTERN, tokenHash } from "@/lib/onboarding-policy";
import { FIREBASE_LOCAL_PROJECT_NUMBER, FIREBASE_MANAGED_HASH, syntheticFirebaseEmail } from "@/lib/firebase-local-policy";
import { FirebaseLocalError, firebaseLocalApi, firebaseLocalIdentity, firebaseLocalTokens, openFirebaseLocal, requireFirebaseLocal, sealFirebaseLocal, type FirebaseLocalTokens } from "@/lib/firebase-local";

const generic = { ok: true, message: "Bilgiler uygunsa e-posta gönderildi. Gelen kutunu ve spam klasörünü kontrol et." };
const invalid = () => new ReadingGroupError("INVALID_TOKEN", 400, "Bağlantı geçersiz, süresi dolmuş veya daha önce kullanılmış.");
type Link = { memberId: number; username: string; email: string; uid: string; projectId: string; sessionVersion: number };
type Session = { tokenHash: string; memberId: number; sessionVersion: number; projectId: string; uid: string; authTime: number; sealed: string; expires: number };
const linkSelect = `SELECT a.member_id AS memberId,a.username,p.email,l.firebase_uid AS uid,l.project_id AS projectId,a.session_version AS sessionVersion
  FROM firebase_local_links l JOIN member_accounts a ON a.member_id=l.member_id JOIN account_profiles p ON p.member_id=a.member_id AND l.mutation_pending=0`;
const denied = (error: unknown) => error instanceof FirebaseLocalError;
async function database() {
  const config = requireFirebaseLocal();
  const db = identityDatabase();
  const marker = await db.prepare("SELECT project_id AS projectId FROM firebase_local_environment WHERE singleton=1").first<{ projectId: string }>();
  if (marker?.projectId !== config.projectId) throw new ReadingGroupError("LOCAL_AUTH_UNAVAILABLE", 503, "Kimlik doğrulama ortamı kullanılamıyor.");
  return db;
}
function synthetic(email: string) {
  if (!syntheticFirebaseEmail(email)) throw new ReadingGroupError("LOCAL_TEST_EMAIL_REQUIRED", 400, "Yerel denemede .test veya .invalid uzantılı bir test adresi kullan.");
}
async function provision(uid: string, email: string) {
  const { projectId } = requireFirebaseLocal(), db = await database();
  synthetic(email);
  const existing = await db.prepare(linkSelect + " WHERE l.project_id=? AND l.firebase_uid=?").bind(projectId, uid).first<Link>();
  if (existing) return existing;
  const pending = await db.prepare("SELECT id FROM firebase_local_registrations WHERE project_id=? AND firebase_uid=? AND email=? AND expires_at>? AND consumed_at IS NULL")
    .bind(projectId, uid, email, Date.now()).first<{ id: string }>();
  if (!pending) return null;
  try {
    await db.batch([
      db.prepare(`INSERT INTO members(name,role) SELECT name,'member' FROM firebase_local_registrations r WHERE id=? AND consumed_at IS NULL AND member_id IS NULL
        AND NOT EXISTS(SELECT 1 FROM member_accounts a WHERE a.username=r.username) AND NOT EXISTS(SELECT 1 FROM account_profiles p WHERE p.email=r.email)`).bind(pending.id),
      db.prepare("UPDATE firebase_local_registrations SET member_id=last_insert_rowid() WHERE id=? AND changes()=1 AND consumed_at IS NULL").bind(pending.id),
      db.prepare(`INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations)
        SELECT member_id,username,?,'',0 FROM firebase_local_registrations WHERE id=? AND member_id IS NOT NULL AND consumed_at IS NULL`).bind(FIREBASE_MANAGED_HASH, pending.id),
      db.prepare(`INSERT INTO account_profiles(member_id,email,verified_at,policy_version)
        SELECT member_id,email,?,? FROM firebase_local_registrations WHERE id=? AND member_id IS NOT NULL AND consumed_at IS NULL`).bind(Date.now(), POLICY_VERSION, pending.id),
      db.prepare(`INSERT INTO firebase_local_links(member_id,project_id,firebase_uid)
        SELECT member_id,project_id,firebase_uid FROM firebase_local_registrations WHERE id=? AND member_id IS NOT NULL AND consumed_at IS NULL`).bind(pending.id),
      db.prepare("UPDATE firebase_local_registrations SET consumed_at=? WHERE id=? AND member_id IS NOT NULL AND consumed_at IS NULL").bind(Date.now(), pending.id),
    ]);
  } catch {
    // A concurrent finalization can win; never infer a link by matching email.
  }
  return db.prepare(linkSelect + " WHERE l.project_id=? AND l.firebase_uid=?").bind(projectId, uid).first<Link>();
}
type Oob = { email: string; requestType: string; oobCode: string };
async function localActionMail(request: Request, email: string, uid: string, purpose: "verify" | "reset", idToken?: string) {
  const { projectId } = requireFirebaseLocal(request.url), db = await database();
  synthetic(email);
  const before = (await firebaseLocalApi("oobCodes")).oobCodes as Oob[];
  const previous = new Set((before || []).map((item) => item.oobCode));
  const requestType = purpose === "verify" ? "VERIFY_EMAIL" : "PASSWORD_RESET";
  await firebaseLocalApi("sendOobCode", { requestType, ...(purpose === "verify" ? { idToken } : { email }) });
  const after = (await firebaseLocalApi("oobCodes")).oobCodes as Oob[];
  const code = after?.findLast((item) => item.email === email && item.requestType === requestType && !previous.has(item.oobCode))?.oobCode;
  if (!code || code.length > 2048) throw new ReadingGroupError("IDENTITY_UNAVAILABLE", 503, "Doğrulama iletisi hazırlanamadı.");
  const token = newToken(), hash = await tokenHash(token);
  const context = JSON.stringify([purpose, hash, projectId, uid, email]);
  const sealed = await sealFirebaseLocal({ code }, context);
  await db.prepare("INSERT INTO firebase_local_actions(token_hash,purpose,project_id,firebase_uid,email,sealed_code,expires_at) VALUES(?,?,?,?,?,?,?)")
    .bind(hash, purpose, projectId, uid, email, sealed, Date.now() + (purpose === "verify" ? 30 : 15) * 60000).run();
  await deliverAccountMail(request, email, purpose, token);
}
export async function registerFirebaseLocal(request: Request, body: Record<string, unknown>) {
  const { projectId } = requireFirebaseLocal(request.url), db = await database();
  const email = normalizeEmail(body.email), name = cleanName(body.name, 80), username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
  if (!email || !name || !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) throw new ReadingGroupError("INVALID_REGISTRATION", 400, "Ad, e-posta ve kullanıcı adını kontrol et.");
  synthetic(email);
  const password = typeof body.password === "string" ? body.password : "", issue = passwordValidationIssue(password, username);
  if (issue) throw new ReadingGroupError("INVALID_PASSWORD", 400, issue);
  if (body.acceptedPolicy !== true) throw new ReadingGroupError("POLICY_REQUIRED", 400, "Kullanım koşullarını kabul etmelisin.");
  if (await db.prepare("SELECT member_id FROM member_accounts WHERE username=? UNION ALL SELECT member_id FROM account_profiles WHERE email=? LIMIT 1").bind(username, email).first()) return generic;
  const reserved = await db.prepare("SELECT id,firebase_uid AS uid FROM firebase_local_registrations WHERE project_id=? AND username=? AND email=? AND consumed_at IS NULL")
    .bind(projectId, username, email).first<{ id: string; uid: string | null }>();
  if (reserved) {
    // Only a checkpointed UID plus its password can resume a pending signup.
    // Never adopt an existing provider account by matching its email.
    if (!reserved.uid) return generic;
    try {
      const tokens = firebaseLocalTokens(await firebaseLocalApi("signInWithPassword", { email, password, returnSecureToken: true }));
      if (tokens.uid !== reserved.uid) return generic;
      const identity = await firebaseLocalIdentity(tokens, false);
      if (normalizeEmail(identity.user.email) !== email) return generic;
      await db.prepare("UPDATE firebase_local_registrations SET expires_at=? WHERE id=? AND consumed_at IS NULL").bind(Date.now() + 30 * 60000, reserved.id).run();
      if (identity.user.emailVerified === true) await provision(tokens.uid, email);
      else {
        await db.prepare("UPDATE firebase_local_actions SET consumed_at=?,sealed_code='' WHERE project_id=? AND firebase_uid=? AND purpose='verify' AND consumed_at IS NULL")
          .bind(Date.now(), projectId, tokens.uid).run();
        await localActionMail(request, email, tokens.uid, "verify", tokens.idToken);
      }
    } catch (error) { if (!denied(error)) throw error; }
    return generic;
  }
  const id = newToken();
  try {
    await db.prepare("INSERT INTO firebase_local_registrations(id,project_id,email,username,name,expires_at) VALUES(?,?,?,?,?,?)")
      .bind(id, projectId, email, username, name, Date.now() + 30 * 60000).run();
  } catch (error) {
    if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) return generic;
    throw error;
  }
  let tokens: FirebaseLocalTokens;
  try { tokens = firebaseLocalTokens(await firebaseLocalApi("signUp", { email, password, returnSecureToken: true })); }
  catch (error) {
    if (error instanceof FirebaseLocalError && error.code === "EMAIL_EXISTS") {
      await db.prepare("DELETE FROM firebase_local_registrations WHERE id=? AND firebase_uid IS NULL").bind(id).run(); return generic;
    }
    throw error;
  }
  await db.prepare("UPDATE firebase_local_registrations SET firebase_uid=? WHERE id=? AND firebase_uid IS NULL").bind(tokens.uid, id).run();
  await firebaseLocalIdentity(tokens, false);
  await localActionMail(request, email, tokens.uid, "verify", tokens.idToken);
  return generic;
}
async function consumeAction(token: unknown, purpose: "verify" | "reset") {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) throw invalid();
  const { projectId } = requireFirebaseLocal(), db = await database(), hash = await tokenHash(token);
  const row = await db.prepare(`UPDATE firebase_local_actions SET consumed_at=? WHERE token_hash=? AND purpose=? AND project_id=? AND consumed_at IS NULL AND expires_at>?
    RETURNING firebase_uid AS uid,email,sealed_code AS sealed`).bind(Date.now(), hash, purpose, projectId, Date.now()).first<{ uid: string; email: string; sealed: string }>();
  if (!row) throw invalid();
  const value = await openFirebaseLocal(row.sealed, JSON.stringify([purpose, hash, projectId, row.uid, row.email]));
  await db.prepare("UPDATE firebase_local_actions SET sealed_code='' WHERE token_hash=?").bind(hash).run();
  if (typeof value.code !== "string") throw invalid();
  return { ...row, code: value.code };
}
export async function verifyFirebaseLocalEmail(token: unknown) {
  const action = await consumeAction(token, "verify");
  try {
    const data = await firebaseLocalApi("update", { oobCode: action.code });
    if (data.localId !== action.uid || normalizeEmail(data.email) !== action.email) throw invalid();
    if (!await provision(action.uid, action.email)) throw invalid();
  } catch (error) { if (denied(error)) throw invalid(); throw error; }
  return { ok: true };
}
export async function recoverFirebaseLocal(request: Request, value: unknown) {
  requireFirebaseLocal(request.url);
  const db = await database(), email = normalizeEmail(value);
  if (!email) throw new ReadingGroupError("INVALID_EMAIL", 400, "Geçerli bir e-posta adresi gir.");
  synthetic(email);
  const link = await db.prepare(linkSelect + " WHERE p.email=?").bind(email).first<Link>();
  if (link && !await accountErasureBlocked(link.memberId)) await localActionMail(request, email, link.uid, "reset");
  return generic;
}
export async function resetFirebaseLocalPassword(token: unknown, password: unknown) {
  const issue = typeof password === "string" ? passwordValidationIssue(password, "") : "Geçerli bir şifre gir.";
  if (issue) throw new ReadingGroupError("INVALID_PASSWORD", 400, issue);
  const db = await database(), { projectId } = requireFirebaseLocal();
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) throw invalid();
  const pending = await db.prepare(`SELECT a.username FROM firebase_local_actions f JOIN firebase_local_links l ON l.firebase_uid=f.firebase_uid AND l.project_id=f.project_id
    JOIN member_accounts a ON a.member_id=l.member_id WHERE f.token_hash=? AND f.purpose='reset' AND f.project_id=? AND f.consumed_at IS NULL AND f.expires_at>?`)
    .bind(await tokenHash(token), projectId, Date.now()).first<{ username: string }>();
  if (!pending) throw invalid();
  const usernameIssue = passwordValidationIssue(password as string, pending.username);
  if (usernameIssue) throw new ReadingGroupError("INVALID_PASSWORD", 400, usernameIssue);
  const action = await consumeAction(token, "reset");
  const link = await db.prepare(linkSelect + " WHERE l.project_id=? AND l.firebase_uid=? AND p.email=?").bind(projectId, action.uid, action.email).first<Link>();
  if (!link || await accountErasureBlocked(link.memberId)) throw invalid();
  await freezePasswordMutation(link.memberId);
  try {
    const data = await firebaseLocalApi("resetPassword", { oobCode: action.code, newPassword: password });
    if (normalizeEmail(data.email) !== action.email) throw invalid();
    await revokeAccount(link.memberId);
  } catch (error) { if (denied(error)) throw invalid(); throw error; }
  return { ok: true };
}
export async function authenticateFirebaseLocal(username: string, password: string) {
  const { projectId } = requireFirebaseLocal(), db = await database();
  const pending = await db.prepare("SELECT email,firebase_uid AS uid FROM firebase_local_registrations WHERE username=? AND project_id=? AND firebase_uid IS NOT NULL AND consumed_at IS NULL AND expires_at>?")
    .bind(username, projectId, Date.now()).first<{ email: string; uid: string }>();
  let link = await db.prepare(linkSelect + " WHERE a.username=? AND l.project_id=?").bind(username, projectId).first<Link>();
  const expected = link || pending;
  if (!expected || (link && await accountErasureBlocked(link.memberId))) return null;
  synthetic(expected.email);
  try {
    const firebase = firebaseLocalTokens(await firebaseLocalApi("signInWithPassword", { email: expected.email, password, returnSecureToken: true }));
    if (firebase.uid !== expected.uid) return null;
    const identity = await firebaseLocalIdentity(firebase);
    if (normalizeEmail(identity.user.email) !== expected.email) return null;
    link ??= await provision(firebase.uid, expected.email);
    if (!link || await accountErasureBlocked(link.memberId)) return null;
    return { memberId: link.memberId, sessionVersion: link.sessionVersion, firebase };
  } catch (error) { if (denied(error)) return null; throw error; }
}
const sessionContext = (row: Session) => JSON.stringify(["session", row.tokenHash, row.memberId, row.sessionVersion, row.projectId, row.uid, row.authTime, row.expires]);
export async function createFirebaseLocalSession(memberId: number, sessionVersion: number, tokens: FirebaseLocalTokens) {
  const { projectId } = requireFirebaseLocal(), db = await database();
  const link = await db.prepare(linkSelect + " WHERE a.member_id=? AND l.project_id=?").bind(memberId, projectId).first<Link>();
  if (!link || link.uid !== tokens.uid || link.sessionVersion !== sessionVersion || await accountErasureBlocked(memberId)) throw invalid();
  const identity = await firebaseLocalIdentity(tokens);
  if (normalizeEmail(identity.user.email) !== link.email) throw invalid();
  const token = newToken();
  const row: Session = { tokenHash: await tokenHash(token), memberId, sessionVersion, projectId, uid: tokens.uid, authTime: identity.authTime, expires: Date.now() + SESSION_MAX_AGE * 1000, sealed: "" };
  row.sealed = await sealFirebaseLocal(tokens, sessionContext(row));
  await db.prepare("INSERT INTO firebase_local_sessions(token_hash,member_id,session_version,project_id,firebase_uid,auth_time,sealed_credentials,expires_at) VALUES(?,?,?,?,?,?,?,?)")
    .bind(row.tokenHash, memberId, sessionVersion, projectId, row.uid, row.authTime, row.sealed, row.expires).run();
  return "fb1." + token;
}
export async function firebaseLocalSessionIdentity(token: string, retry = true): Promise<SessionIdentity | null> {
  const { projectId } = requireFirebaseLocal(), db = await database();
  if (!/^fb1\.[a-f0-9]{64}$/.test(token)) return null;
  const hash = await tokenHash(token.slice(4));
  const row = await db.prepare(`SELECT s.token_hash AS tokenHash,s.member_id AS memberId,s.session_version AS sessionVersion,s.project_id AS projectId,s.firebase_uid AS uid,s.auth_time AS authTime,s.expires_at AS expires,s.sealed_credentials AS sealed
    FROM firebase_local_sessions s JOIN firebase_local_links l ON l.member_id=s.member_id AND l.firebase_uid=s.firebase_uid AND l.project_id=s.project_id AND l.mutation_pending=0
    JOIN member_accounts a ON a.member_id=s.member_id AND a.session_version=s.session_version
    WHERE s.token_hash=? AND s.project_id=? AND s.revoked_at IS NULL AND s.expires_at>?`).bind(hash, projectId, Date.now()).first<Session>();
  if (!row || await accountErasureBlocked(row.memberId)) return null;
  try {
    let tokens = await openFirebaseLocal(row.sealed, sessionContext(row)) as unknown as FirebaseLocalTokens;
    let currentSeal = row.sealed;
    if (tokens.uid !== row.uid) return null;
    const payload = JSON.parse(atob(tokens.idToken.split(".")[1].replaceAll("-", "+").replaceAll("_", "/")));
    if (Number(payload.exp) <= Math.floor(Date.now() / 1000) + 30) {
      const fresh = await firebaseLocalApi("token", { grant_type: "refresh_token", refresh_token: tokens.refreshToken });
      if (fresh.project_id !== FIREBASE_LOCAL_PROJECT_NUMBER) return null;
      tokens = firebaseLocalTokens(fresh);
      if (tokens.uid !== row.uid) return null;
      const sealed = await sealFirebaseLocal(tokens, sessionContext(row));
      const updated = await db.prepare("UPDATE firebase_local_sessions SET sealed_credentials=? WHERE token_hash=? AND revoked_at IS NULL AND sealed_credentials=?").bind(sealed, hash, row.sealed).run();
      if (updated.meta.changes !== 1) return retry ? firebaseLocalSessionIdentity(token, false) : null;
      currentSeal = sealed;
    }
    const identity = await firebaseLocalIdentity(tokens);
    if (identity.authTime !== row.authTime) return null;
    const current = await db.prepare(`SELECT 1 FROM firebase_local_sessions s JOIN member_accounts a ON a.member_id=s.member_id AND a.session_version=s.session_version
      JOIN firebase_local_links l ON l.member_id=s.member_id AND l.firebase_uid=s.firebase_uid AND l.project_id=s.project_id AND l.mutation_pending=0
      JOIN account_profiles p ON p.member_id=a.member_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND s.sealed_credentials=? AND p.email=?`)
      .bind(hash, Date.now(), currentSeal, normalizeEmail(identity.user.email)).first();
    if (!current || await accountErasureBlocked(row.memberId)) return null;
    return { memberId: row.memberId, sessionVersion: row.sessionVersion, firebaseLocal: true };
  } catch (error) {
    if (error instanceof ReadingGroupError) throw error;
    return null;
  }
}
export async function revokeFirebaseLocalSession(token: string | undefined) {
  if (!token || !/^fb1\.[a-f0-9]{64}$/.test(token)) return;
  await (await database()).prepare("UPDATE firebase_local_sessions SET revoked_at=?,sealed_credentials='' WHERE token_hash=? AND revoked_at IS NULL").bind(Date.now(), await tokenHash(token.slice(4))).run();
}
async function revokeAccount(memberId: number) {
  const db = await database();
  const results = await db.batch([
    db.prepare("UPDATE member_accounts SET session_version=session_version+1,failed_attempts=0,locked_until=NULL,password_changed_at=CURRENT_TIMESTAMP WHERE member_id=? RETURNING session_version AS version").bind(memberId),
    db.prepare("UPDATE firebase_local_sessions SET revoked_at=?,sealed_credentials='' WHERE member_id=? AND revoked_at IS NULL").bind(Date.now(), memberId),
    db.prepare("UPDATE firebase_local_links SET mutation_pending=0 WHERE member_id=?").bind(memberId),
  ]);
  return Number((results[0].results[0] as { version: number }).version);
}
async function freezePasswordMutation(memberId: number) {
  const row = await (await database()).prepare("UPDATE firebase_local_links SET mutation_pending=1 WHERE member_id=? AND mutation_pending=0 RETURNING member_id")
    .bind(memberId).first();
  if (!row) throw new ReadingGroupError("IDENTITY_OPERATION_PENDING", 503, "Hesap işlemi tamamlanamadı. Destekle iletişime geç.");
  // A cross-service failure retains this durable freeze. Only a successful
  // password update plus atomic Koru session revocation may release it.
}
export async function changeFirebaseLocalPassword(memberId: number, current: string, next: string) {
  const db = await database(), link = await db.prepare(linkSelect + " WHERE a.member_id=?").bind(memberId).first<Link>();
  const invalidCurrent = { ok: false as const, reason: "invalid-current" as const, error: "Mevcut şifre doğrulanamadı." };
  if (!link || await accountErasureBlocked(memberId)) return invalidCurrent;
  const issue = passwordValidationIssue(next, link.username);
  if (issue || next === current) return { ok: false as const, reason: "invalid-new" as const, error: issue || "Yeni şifre mevcut şifreden farklı olmalı." };
  try {
    const authenticated = await authenticateFirebaseLocal(link.username, current);
    if (!authenticated || authenticated.memberId !== memberId) return invalidCurrent;
    await freezePasswordMutation(memberId);
    const tokens = firebaseLocalTokens(await firebaseLocalApi("update", { idToken: authenticated.firebase.idToken, password: next, returnSecureToken: true }));
    if (tokens.uid !== link.uid) return invalidCurrent;
    await firebaseLocalIdentity(tokens);
    const sessionVersion = await revokeAccount(memberId);
    return { ok: true as const, sessionVersion, firebase: tokens };
  } catch (error) { if (denied(error)) return invalidCurrent; throw error; }
}
