import { after } from "next/server";
import { identityDatabase } from "@/db/database";
import { accountErasureBlocked } from "@/db/account-erasure-state";
import { ReadingGroupError } from "@/lib/groups";
import { SESSION_MAX_AGE, type SessionIdentity } from "@/lib/auth";
import { cleanName, newToken, normalizeEmail, POLICY_VERSION, tokenHash } from "@/lib/onboarding-policy";
import { normalizeUsername, passwordValidationIssue } from "@/lib/password";
import { requireTestEmail } from "@/lib/onboarding-security";
import { FIREBASE_MANAGED_PASSWORD, validFirebaseActionCode } from "@/lib/firebase-auth-policy";
import { firebaseTokens, FirebaseError, type FirebaseTokens, type FirebaseIdentity } from "@/lib/firebase-protocol";
import { firebaseOperationError, firebaseUnavailable, openFirebase, remoteFirebase, requireFirebase, sealFirebase } from "@/lib/firebase-auth";

const generic = { ok: true, message: "Bilgiler uygunsa e-posta gönderildi. Gelen kutunu ve spam klasörünü kontrol et." };
const invalid = () => new ReadingGroupError("INVALID_TOKEN", 400, "Bağlantı geçersiz, süresi dolmuş veya daha önce kullanılmış.");
type Link = { memberId: number; username: string; email: string; uid: string; projectId: string; sessionVersion: number;
  mutationPending: number; mutationKind: string | null; mutationValidSince: number | null };
type Pending = { id: string; uid: string | null; email: string; claimMemberId: number | null; claimVersion: number | null; expires: number };
const linkSelect = `SELECT a.member_id AS memberId,a.username,p.email,l.firebase_uid AS uid,l.project_id AS projectId,a.session_version AS sessionVersion,
  l.mutation_pending AS mutationPending,l.mutation_kind AS mutationKind,l.mutation_valid_since AS mutationValidSince
  FROM firebase_links l JOIN member_accounts a ON a.member_id=l.member_id JOIN account_profiles p ON p.member_id=a.member_id`;
async function database() {
  const config = requireFirebase(), db = identityDatabase();
  const marker = await db.prepare("SELECT project_id AS projectId FROM firebase_environment WHERE singleton=1").first<{ projectId: string }>();
  if (marker?.projectId !== config.projectId) throw new ReadingGroupError("IDENTITY_UNAVAILABLE", 503, "Kimlik doğrulama ortamı kullanılamıyor.");
  return db;
}
async function findLink(username: string) {
  return (await database()).prepare(linkSelect + " WHERE a.username=? AND l.project_id=?").bind(username, requireFirebase().projectId).first<Link>();
}
async function pendingFor(username: string) {
  return (await database()).prepare(`SELECT id,firebase_uid AS uid,email,claim_member_id AS claimMemberId,claim_version AS claimVersion,expires_at AS expires
    FROM firebase_registrations WHERE username=? AND project_id=? AND consumed_at IS NULL`).bind(username, requireFirebase().projectId).first<Pending>();
}
async function sendAction(email: string, purpose: "verify" | "reset", idToken?: string) {
  requireTestEmail(email);
  await remoteFirebase().api("sendOobCode", { requestType: purpose === "verify" ? "VERIFY_EMAIL" : "PASSWORD_RESET",
    ...(purpose === "verify" ? { idToken } : { email }), continueUrl: requireFirebase().applicationOrigin + "/login", canHandleCodeInApp: false });
}

async function provision(uid: string, email: string) {
  const db = await database(), { projectId } = requireFirebase();
  const existing = await db.prepare(linkSelect + " WHERE l.project_id=? AND l.firebase_uid=?").bind(projectId, uid).first<Link>();
  if (existing) return existing;
  const pending = await db.prepare("SELECT id,claim_member_id AS claimMemberId FROM firebase_registrations WHERE project_id=? AND firebase_uid=? AND email=? AND expires_at>? AND consumed_at IS NULL")
    .bind(projectId, uid, email, Date.now()).first<{ id: string; claimMemberId: number | null }>();
  if (!pending || (pending.claimMemberId !== null && await accountErasureBlocked(pending.claimMemberId))) return null;
  try {
    if (pending.claimMemberId !== null) {
      // A verified, checkpointed UID plus the captured old-account version is the claim proof.
      await db.batch([
        db.prepare(`INSERT INTO firebase_links(member_id,project_id,firebase_uid)
          SELECT r.claim_member_id,r.project_id,r.firebase_uid FROM firebase_registrations r JOIN member_accounts a ON a.member_id=r.claim_member_id
          WHERE r.id=? AND r.consumed_at IS NULL AND r.expires_at>? AND a.session_version=r.claim_version AND a.password_hash NOT LIKE 'managed:%'
          AND NOT EXISTS(SELECT 1 FROM account_profiles p WHERE p.member_id=a.member_id OR p.email=r.email)
          AND NOT EXISTS(SELECT 1 FROM account_erasure_jobs j WHERE j.account_member_id=a.member_id)`).bind(pending.id, Date.now()),
        db.prepare(`INSERT INTO account_profiles(member_id,email,verified_at,policy_version)
          SELECT claim_member_id,email,?,? FROM firebase_registrations WHERE id=? AND changes()=1`).bind(Date.now(), POLICY_VERSION, pending.id),
        db.prepare(`UPDATE member_accounts SET password_hash=?,password_salt='',password_iterations=0,session_version=session_version+1,
          failed_attempts=0,locked_until=NULL,password_changed_at=CURRENT_TIMESTAMP
          WHERE member_id=(SELECT claim_member_id FROM firebase_registrations WHERE id=? AND consumed_at IS NULL AND claim_version=member_accounts.session_version) AND changes()=1`)
          .bind(FIREBASE_MANAGED_PASSWORD, pending.id),
        db.prepare("UPDATE firebase_registrations SET member_id=claim_member_id,consumed_at=? WHERE id=? AND changes()=1").bind(Date.now(), pending.id),
      ]);
    } else {
      await db.batch([
        db.prepare(`INSERT INTO members(name,role) SELECT name,'member' FROM firebase_registrations r WHERE id=? AND consumed_at IS NULL AND member_id IS NULL AND expires_at>?
          AND NOT EXISTS(SELECT 1 FROM member_accounts a WHERE a.username=r.username) AND NOT EXISTS(SELECT 1 FROM account_profiles p WHERE p.email=r.email)`).bind(pending.id, Date.now()),
        db.prepare("UPDATE firebase_registrations SET member_id=last_insert_rowid() WHERE id=? AND changes()=1 AND consumed_at IS NULL").bind(pending.id),
        db.prepare(`INSERT INTO member_accounts(member_id,username,password_hash,password_salt,password_iterations)
          SELECT member_id,username,?,'',0 FROM firebase_registrations WHERE id=? AND member_id IS NOT NULL AND consumed_at IS NULL`).bind(FIREBASE_MANAGED_PASSWORD, pending.id),
        db.prepare(`INSERT INTO account_profiles(member_id,email,verified_at,policy_version)
          SELECT member_id,email,?,? FROM firebase_registrations WHERE id=? AND member_id IS NOT NULL AND consumed_at IS NULL`).bind(Date.now(), POLICY_VERSION, pending.id),
        db.prepare(`INSERT INTO firebase_links(member_id,project_id,firebase_uid)
          SELECT member_id,project_id,firebase_uid FROM firebase_registrations WHERE id=? AND member_id IS NOT NULL AND consumed_at IS NULL`).bind(pending.id),
        db.prepare("UPDATE firebase_registrations SET consumed_at=? WHERE id=? AND member_id IS NOT NULL AND consumed_at IS NULL").bind(Date.now(), pending.id),
      ]);
    }
  } catch { /* Concurrent finalization may win; only the exact stored UID link can succeed. */ }
  return db.prepare(linkSelect + " WHERE l.project_id=? AND l.firebase_uid=?").bind(projectId, uid).first<Link>();
}

type Claim = { memberId: number; sessionVersion: number; username: string; name: string };
function registrationInput(body: Record<string, unknown>, claim?: Claim) {
  const email = normalizeEmail(body.email), name = claim?.name || cleanName(body.name, 80), username = claim?.username || (typeof body.username === "string" ? normalizeUsername(body.username) : "");
  if (!email || !name || !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) throw new ReadingGroupError("INVALID_REGISTRATION", 400, "Ad, e-posta ve kullanıcı adını kontrol et.");
  requireTestEmail(email);
  const password = typeof body.password === "string" ? body.password : "", issue = passwordValidationIssue(password, username);
  if (issue) throw new ReadingGroupError("INVALID_PASSWORD", 400, issue);
  if (body.acceptedPolicy !== true) throw new ReadingGroupError("POLICY_REQUIRED", 400, "Kullanım koşullarını kabul etmelisin.");
  return { email, name, username, password };
}
function deferAccountOperation(operation: "registration" | "recovery", task: () => Promise<unknown>) {
  // Like account-mail, vinext runs after() through the request's waitUntil.
  // Do not retry ambiguous provider writes or include provider/user data in logs.
  after(async () => {
    try { await task(); }
    catch { console.error(`Firebase ${operation} task failed`); }
  });
}
async function beginRegistration(request: Request, body: Record<string, unknown>, claim?: Claim) {
  const { projectId } = requireFirebase(request.url), db = await database();
  const { email, name, username, password } = registrationInput(body, claim);
  if (await db.prepare("SELECT member_id FROM account_profiles WHERE email=? LIMIT 1").bind(email).first()) return generic;
  if (!claim && await db.prepare("SELECT member_id FROM member_accounts WHERE username=?").bind(username).first()) return generic;
  let pending = await pendingFor(username);
  if (pending) {
    if (pending.email !== email || pending.claimMemberId !== (claim?.memberId ?? null) || pending.claimVersion !== (claim?.sessionVersion ?? null) || !pending.uid) return generic;
    try {
      const tokens = firebaseTokens(await remoteFirebase().api("signInWithPassword", { email, password, returnSecureToken: true }));
      const identity = await remoteFirebase().identity(tokens, false);
      if (tokens.uid !== pending.uid || identity.email !== email) return generic;
      await db.prepare("UPDATE firebase_registrations SET expires_at=? WHERE id=? AND consumed_at IS NULL").bind(Date.now() + 86400000, pending.id).run();
      if (!identity.verified) await sendAction(email, "verify", tokens.idToken);
    } catch (error) { if (!(error instanceof FirebaseError) || firebaseUnavailable(error)) firebaseOperationError(error); }
    return generic;
  }
  const id = newToken();
  try {
    await db.prepare("INSERT INTO firebase_registrations(id,project_id,email,username,name,expires_at,claim_member_id,claim_version) VALUES(?,?,?,?,?,?,?,?)")
      .bind(id, projectId, email, username, name, Date.now() + 86400000, claim?.memberId ?? null, claim?.sessionVersion ?? null).run();
  } catch (error) { if (error instanceof Error && /UNIQUE constraint failed/.test(error.message)) return generic; throw error; }
  pending = await pendingFor(username);
  if (!pending || pending.id !== id) throw new ReadingGroupError("IDENTITY_UNAVAILABLE", 503, "Kayıt şu anda tamamlanamıyor.");
  try {
    const tokens = firebaseTokens(await remoteFirebase().api("signUp", { email, password, returnSecureToken: true }));
    await db.prepare("UPDATE firebase_registrations SET firebase_uid=? WHERE id=? AND firebase_uid IS NULL").bind(tokens.uid, id).run();
    const identity = await remoteFirebase().identity(tokens, false);
    if (identity.email !== email) throw new FirebaseError("INVALID_IDENTITY");
    await sendAction(email, "verify", tokens.idToken);
  } catch (error) {
    if (error instanceof FirebaseError && error.code === "EMAIL_EXISTS") {
      await db.prepare("DELETE FROM firebase_registrations WHERE id=? AND firebase_uid IS NULL").bind(id).run(); return generic;
    }
    firebaseOperationError(error);
  }
  return generic;
}
export async function registerFirebaseAccount(request: Request, body: Record<string, unknown>) {
  requireFirebase(request.url);
  registrationInput(body);
  await database();
  // Only input/configuration checks affect the response; identity lookups and
  // provider calls must not reveal account existence through latency or errors.
  deferAccountOperation("registration", () => beginRegistration(request, body));
  return generic;
}

export async function linkFirebaseAccount(request: Request, memberId: number, body: Record<string, unknown>) {
  requireFirebase(request.url);
  const db = await database();
  const row = await db.prepare("SELECT a.username,m.name FROM member_accounts a JOIN members m ON m.id=a.member_id WHERE a.member_id=? AND a.password_hash NOT LIKE 'managed:%'").bind(memberId).first<{ username: string; name: string }>();
  const old = row && typeof body.password === "string" ? await (await import("@/db/accounts")).authenticateLegacyForFirebase(row.username, body.password) : null;
  if (!old || old.memberId !== memberId || await accountErasureBlocked(memberId)) throw new ReadingGroupError("INVALID_PASSWORD", 400, "Mevcut şifre doğrulanamadı.");
  if (body.newPassword === body.password) throw new ReadingGroupError("INVALID_PASSWORD", 400, "Yeni hesap şifren mevcut şifreden farklı olmalı.");
  await beginRegistration(request, { ...body, password: body.newPassword }, { ...old, username: row!.username, name: row!.name });
  return { ok: true, message: "Bilgiler uygunsa doğrulama postası gönderildi. E-postanı doğruladıktan sonra mevcut kullanıcı adın ve yeni hesap şifrenle giriş yap; grupların korunur." };
}

async function completeMutation(memberId: number, kind: "password" | "reset") {
  const db = await database();
  const results = await db.batch([
    db.prepare(`UPDATE member_accounts SET session_version=session_version+1,failed_attempts=0,locked_until=NULL,password_changed_at=CURRENT_TIMESTAMP
      WHERE member_id=? AND EXISTS(SELECT 1 FROM firebase_links WHERE member_id=? AND mutation_pending=1 AND mutation_kind=?)`).bind(memberId, memberId, kind),
    db.prepare("UPDATE firebase_links SET mutation_pending=0,mutation_started_at=NULL,mutation_valid_since=NULL,mutation_kind=NULL WHERE member_id=? AND mutation_kind=? AND changes()=1").bind(memberId, kind),
    db.prepare("UPDATE firebase_sessions SET revoked_at=?,sealed_credentials='' WHERE member_id=? AND revoked_at IS NULL").bind(Date.now(), memberId),
  ]);
  if (results[0].meta.changes !== 1 || results[1].meta.changes !== 1) throw new ReadingGroupError("IDENTITY_UNAVAILABLE", 503, "Hesap güvenlik işlemi tamamlanamadı.");
}
export async function authenticateFirebaseAccount(username: string, password: string) {
  const link = await findLink(username), pending = link ? null : await pendingFor(username), expected = link || pending;
  if (!expected?.uid || (link && (link.mutationKind === "erasure" || await accountErasureBlocked(link.memberId)))) return null;
  if (!link && (!pending || pending.expires <= Date.now())) return null;
  try {
    const tokens = firebaseTokens(await remoteFirebase().api("signInWithPassword", { email: expected.email, password, returnSecureToken: true }));
    const identity = await remoteFirebase().identity(tokens);
    if (tokens.uid !== expected.uid || identity.email !== expected.email) return null;
    if (link?.mutationPending) {
      if (link.mutationKind !== "password" || link.mutationValidSince === null || identity.validSince <= link.mutationValidSince
        || Math.floor(Date.now() / 1000) - identity.authTime > 300) return null;
      await completeMutation(link.memberId, "password");
    }
    const current = await provision(tokens.uid, identity.email);
    if (!current || current.mutationPending || await accountErasureBlocked(current.memberId)) return null;
    return { memberId: current.memberId, sessionVersion: current.sessionVersion, firebase: tokens };
  } catch (error) {
    if (firebaseUnavailable(error)) firebaseOperationError(error);
    if (error instanceof FirebaseError) return null;
    throw error;
  }
}

export async function recoverFirebaseAccount(request: Request, value: unknown) {
  requireFirebase(request.url);
  const email = normalizeEmail(value), db = await database();
  if (!email) throw new ReadingGroupError("INVALID_EMAIL", 400, "Geçerli bir e-posta adresi gir.");
  requireTestEmail(email);
  deferAccountOperation("recovery", async () => {
    const link = await db.prepare(linkSelect + " WHERE p.email=? AND l.project_id=?").bind(email, requireFirebase().projectId).first<Link>();
    const pending = link ? null : await db.prepare("SELECT firebase_uid AS uid FROM firebase_registrations WHERE email=? AND project_id=? AND firebase_uid IS NOT NULL AND consumed_at IS NULL")
      .bind(email, requireFirebase().projectId).first<{ uid: string }>();
    if ((link && link.mutationKind !== "erasure" && !await accountErasureBlocked(link.memberId)) || pending) await sendAction(email, "reset");
  });
  return generic;
}
export async function firebaseEmailAction(body: Record<string, unknown>) {
  const code = validFirebaseActionCode(body.code) ? body.code : null;
  if (!code || !["verifyEmail", "resetPassword"].includes(String(body.mode))) throw invalid();
  try {
    if (body.mode === "verifyEmail") {
      const result = await remoteFirebase().api("update", { oobCode: code });
      if (typeof result.localId !== "string" || !normalizeEmail(result.email)) throw invalid();
      return { ok: true, message: "E-posta adresin doğrulandı. Kullanıcı adın ve şifrenle giriş yap." };
    }
    const issue = typeof body.password === "string" ? passwordValidationIssue(body.password, "") : "Geçerli bir şifre gir.";
    if (issue) throw new ReadingGroupError("INVALID_PASSWORD", 400, issue);
    const info = await remoteFirebase().api("resetPassword", { oobCode: code }), email = normalizeEmail(info.email);
    if (!email || info.requestType !== "PASSWORD_RESET") throw invalid();
    const db = await database(), { projectId } = requireFirebase();
    const link = await db.prepare(linkSelect + " WHERE p.email=? AND l.project_id=?").bind(email, projectId).first<Link>();
    const pending = link ? null : await db.prepare("SELECT firebase_uid AS uid,username FROM firebase_registrations WHERE email=? AND project_id=? AND consumed_at IS NULL")
      .bind(email, projectId).first<{ uid: string; username: string }>();
    if ((!link && !pending?.uid) || (link && (link.mutationKind === "erasure" || await accountErasureBlocked(link.memberId)))) throw invalid();
    const usernameIssue = passwordValidationIssue(body.password as string, link?.username || pending!.username);
    if (usernameIssue) throw new ReadingGroupError("INVALID_PASSWORD", 400, usernameIssue);
    if (link) {
      const frozen = await db.prepare(`UPDATE firebase_links SET mutation_pending=1,mutation_kind='reset',mutation_started_at=?,mutation_valid_since=NULL
        WHERE member_id=? AND project_id=? AND (mutation_kind IS NULL OR mutation_kind IN ('password','reset')) RETURNING member_id`).bind(Date.now(), link.memberId, projectId).first();
      if (!frozen) throw invalid();
    }
    const result = await remoteFirebase().api("resetPassword", { oobCode: code, newPassword: body.password });
    if (normalizeEmail(result.email) !== email) throw invalid();
    const tokens = firebaseTokens(await remoteFirebase().api("signInWithPassword", { email, password: body.password, returnSecureToken: true }));
    const identity = await remoteFirebase().identity(tokens, false);
    if (tokens.uid !== (link?.uid || pending?.uid) || identity.email !== email) throw invalid();
    if (link) await completeMutation(link.memberId, "reset");
    return { ok: true, message: "Şifren yenilendi. Diğer oturumlar kapatıldı. Yeniden giriş yap." };
  } catch (error) { if (firebaseUnavailable(error)) firebaseOperationError(error); if (error instanceof FirebaseError) throw invalid(); throw error; }
}

type Session = { tokenHash: string; memberId: number; sessionVersion: number; projectId: string; uid: string; authTime: number; expires: number; sealed: string };
const contextFor = (row: Session) => JSON.stringify(["session-v1", row.tokenHash, row.memberId, row.sessionVersion, row.projectId, row.uid, row.authTime, row.expires]);
export async function createFirebaseSession(memberId: number, version: number, tokens: FirebaseTokens) {
  const db = await database(), { projectId } = requireFirebase();
  const link = await db.prepare(linkSelect + " WHERE a.member_id=? AND l.project_id=?").bind(memberId, projectId).first<Link>();
  if (!link || link.mutationPending || link.uid !== tokens.uid || link.sessionVersion !== version || await accountErasureBlocked(memberId)) throw invalid();
  let identity: FirebaseIdentity;
  try { identity = await remoteFirebase().identity(tokens); } catch (error) { firebaseOperationError(error); }
  if (identity.email !== link.email) throw invalid();
  const token = newToken();
  const row: Session = { tokenHash: await tokenHash(token), memberId, sessionVersion: version, projectId, uid: tokens.uid, authTime: identity.authTime, expires: Date.now() + SESSION_MAX_AGE * 1000, sealed: "" };
  row.sealed = await sealFirebase(tokens, contextFor(row));
  await db.prepare("INSERT INTO firebase_sessions(token_hash,member_id,session_version,project_id,firebase_uid,auth_time,sealed_credentials,expires_at) VALUES(?,?,?,?,?,?,?,?)")
    .bind(row.tokenHash, memberId, version, projectId, tokens.uid, row.authTime, row.sealed, row.expires).run();
  return "fb2." + token;
}
export async function firebaseSessionIdentity(token: string, retry = true): Promise<SessionIdentity | null> {
  if (!/^fb2\.[a-f0-9]{64}$/.test(token)) return null;
  const db = await database(), { projectId, projectNumber } = requireFirebase(), hash = await tokenHash(token.slice(4));
  const row = await db.prepare(`SELECT s.token_hash AS tokenHash,s.member_id AS memberId,s.session_version AS sessionVersion,s.project_id AS projectId,
    s.firebase_uid AS uid,s.auth_time AS authTime,s.expires_at AS expires,s.sealed_credentials AS sealed FROM firebase_sessions s
    JOIN firebase_links l ON l.member_id=s.member_id AND l.firebase_uid=s.firebase_uid AND l.project_id=s.project_id AND l.mutation_pending=0
    JOIN member_accounts a ON a.member_id=s.member_id AND a.session_version=s.session_version AND a.password_hash=?
    WHERE s.token_hash=? AND s.project_id=? AND s.revoked_at IS NULL AND s.expires_at>?`).bind(FIREBASE_MANAGED_PASSWORD, hash, projectId, Date.now()).first<Session>();
  if (!row || await accountErasureBlocked(row.memberId)) return null;
  try {
    let tokens = firebaseTokens(await openFirebase(row.sealed, contextFor(row)));
    if (tokens.uid !== row.uid) return null;
    let currentSeal = row.sealed;
    const { decodeJwt } = await import("jose");
    if (Number(decodeJwt(tokens.idToken).exp) <= Math.floor(Date.now() / 1000) + 30) {
      const data = await remoteFirebase().api("token", { grant_type: "refresh_token", refresh_token: tokens.refreshToken });
      if (data.project_id !== projectNumber) return null;
      tokens = firebaseTokens(data);
      if (tokens.uid !== row.uid) return null;
      currentSeal = await sealFirebase(tokens, contextFor(row));
      const result = await db.prepare("UPDATE firebase_sessions SET sealed_credentials=? WHERE token_hash=? AND revoked_at IS NULL AND sealed_credentials=?").bind(currentSeal, hash, row.sealed).run();
      if (result.meta.changes !== 1) return retry ? firebaseSessionIdentity(token, false) : null;
    }
    const identity = await remoteFirebase().identity(tokens);
    if (identity.authTime !== row.authTime) return null;
    const current = await db.prepare(`SELECT 1 FROM firebase_sessions s JOIN member_accounts a ON a.member_id=s.member_id AND a.session_version=s.session_version AND a.password_hash=?
      JOIN firebase_links l ON l.member_id=s.member_id AND l.firebase_uid=s.firebase_uid AND l.project_id=s.project_id AND l.mutation_pending=0
      JOIN account_profiles p ON p.member_id=a.member_id WHERE s.token_hash=? AND s.revoked_at IS NULL AND s.expires_at>? AND s.sealed_credentials=? AND p.email=?`)
      .bind(FIREBASE_MANAGED_PASSWORD, hash, Date.now(), currentSeal, identity.email).first();
    return current && !await accountErasureBlocked(row.memberId) ? { memberId: row.memberId, sessionVersion: row.sessionVersion, firebase: true } : null;
  } catch (error) { if (firebaseUnavailable(error)) firebaseOperationError(error); if (error instanceof ReadingGroupError) throw error; return null; }
}
export async function revokeFirebaseSession(token: string | undefined) {
  if (token && /^fb2\.[a-f0-9]{64}$/.test(token)) await (await database()).prepare("UPDATE firebase_sessions SET revoked_at=?,sealed_credentials='' WHERE token_hash=? AND revoked_at IS NULL").bind(Date.now(), await tokenHash(token.slice(4))).run();
}
export async function changeFirebasePassword(memberId: number, oldPassword: string, password: string) {
  const db = await database(), { projectId } = requireFirebase();
  const link = await db.prepare(linkSelect + " WHERE a.member_id=? AND l.project_id=?").bind(memberId, projectId).first<Link>();
  if (!link) return { ok: false as const, reason: "migration-required" as const, error: "Önce Hesabım bölümünde e-postanı ve yeni hesap şifreni doğrula." };
  if (link.mutationPending || await accountErasureBlocked(memberId)) return { ok: false as const, reason: "invalid-current" as const, error: "Hesap güvenlik işlemi bekliyor. Şifremi unuttum ile yeniden doğrula." };
  const issue = passwordValidationIssue(password, link.username);
  if (issue || password === oldPassword) return { ok: false as const, reason: "invalid-new" as const, error: issue || "Yeni şifre mevcut şifreden farklı olmalı." };
  let current: FirebaseTokens; let identity: FirebaseIdentity;
  try {
    current = firebaseTokens(await remoteFirebase().api("signInWithPassword", { email: link.email, password: oldPassword, returnSecureToken: true }));
    identity = await remoteFirebase().identity(current);
    if (current.uid !== link.uid || identity.email !== link.email) throw new FirebaseError("INVALID_IDENTITY");
  } catch (error) {
    if (firebaseUnavailable(error)) firebaseOperationError(error);
    if (error instanceof FirebaseError) return { ok: false as const, reason: "invalid-current" as const, error: "Mevcut şifre yanlış." };
    throw error;
  }
  const frozen = await db.prepare("UPDATE firebase_links SET mutation_pending=1,mutation_kind='password',mutation_started_at=?,mutation_valid_since=? WHERE member_id=? AND mutation_pending=0 RETURNING member_id")
    .bind(Date.now(), identity.validSince, memberId).first();
  if (!frozen) throw new ReadingGroupError("IDENTITY_UNAVAILABLE", 503, "Hesap güvenlik işlemi zaten sürüyor.");
  try {
    const next = firebaseTokens(await remoteFirebase().api("update", { idToken: current.idToken, password, returnSecureToken: true }));
    const checked = await remoteFirebase().identity(next);
    if (next.uid !== link.uid || checked.email !== link.email) throw new FirebaseError("INVALID_IDENTITY");
    await completeMutation(memberId, "password");
    const updated = await findLink(link.username);
    if (!updated || updated.mutationPending) throw invalid();
    return { ok: true as const, sessionVersion: updated.sessionVersion, firebase: next };
  } catch (error) { firebaseOperationError(error); }
}
