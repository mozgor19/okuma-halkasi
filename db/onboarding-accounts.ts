import { identityDatabase } from "@/db/database";
import { authenticateAccount } from "@/db/accounts";
import { ReadingGroupError } from "@/lib/groups";
import { cleanName, newToken, normalizeEmail, POLICY_VERSION, TOKEN_PATTERN, tokenHash } from "@/lib/onboarding-policy";
import { hashPassword, normalizeUsername, passwordValidationIssue } from "@/lib/password";
import { deliverAccountMail } from "@/lib/account-mail";
import { requireTestEmail } from "@/lib/onboarding-security";

const invalidToken = () => new ReadingGroupError("INVALID_TOKEN", 400, "Bağlantı geçersiz, süresi dolmuş veya daha önce kullanılmış.");
const genericMessage = "Bilgiler uygunsa e-posta gönderildi. Gelen kutunu ve spam klasörünü kontrol et.";

async function cleanup() {
  const db = identityDatabase();
  await db.batch(["pending_registrations", "account_recovery_tokens", "account_email_verifications"].map((table) =>
    db.prepare(`DELETE FROM ${table} WHERE expires_at < ? OR consumed_at IS NOT NULL`).bind(Date.now())));
}

export async function registerAccount(request: Request, body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  const name = cleanName(body.name, 80);
  const username = typeof body.username === "string" ? normalizeUsername(body.username) : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!email || !name || !/^[a-z0-9][a-z0-9._-]{2,39}$/.test(username)) throw new ReadingGroupError("INVALID_REGISTRATION", 400, "Ad, e-posta ve kullanıcı adını kontrol et. Kullanıcı adı 3–40 karakter olmalı.");
  requireTestEmail(email);
  const issue = passwordValidationIssue(password, username);
  if (issue) throw new ReadingGroupError("INVALID_PASSWORD", 400, issue);
  if (body.acceptedPolicy !== true) throw new ReadingGroupError("POLICY_REQUIRED", 400, "Kullanım koşullarını kabul etmelisin.");
  await cleanup();
  const db = identityDatabase();
  const existing = await db.prepare("SELECT member_id FROM member_accounts WHERE username = ? UNION ALL SELECT member_id FROM account_profiles WHERE email = ? LIMIT 1").bind(username, email).first();
  // Derive even for duplicate accounts; no email/username existence oracle in the response.
  const record = await hashPassword(password);
  if (!existing) {
    const token = newToken();
    const hash = await tokenHash(token);
    await db.prepare(`INSERT INTO pending_registrations(token_hash, email, username, name, password_hash, password_salt, password_iterations, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(hash, email, username, name, record.hash, record.salt, record.iterations, Date.now() + 30 * 60_000).run();
    try { await deliverAccountMail(request, email, "verify", token); }
    catch (error) { await db.prepare("DELETE FROM pending_registrations WHERE token_hash = ?").bind(hash).run(); throw error; }
  }
  return { ok: true, message: genericMessage };
}

export async function verifyEmail(token: unknown) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token)) throw invalidToken();
  const db = identityDatabase();
  const hash = await tokenHash(token);
  const now = Date.now();
  const pending = await db.prepare("SELECT token_hash, email FROM pending_registrations WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?").bind(hash, now).first<{ token_hash: string; email: string }>();
  if (pending) {
    requireTestEmail(pending.email);
    try {
      // D1 batch is one transaction: competing verifications cannot allocate two accounts.
      const result = await db.batch([
        db.prepare(`INSERT INTO members(name, role) SELECT name, 'member' FROM pending_registrations p
          WHERE p.token_hash = ? AND p.consumed_at IS NULL AND p.expires_at > ?
          AND NOT EXISTS (SELECT 1 FROM member_accounts a WHERE a.username = p.username)
          AND NOT EXISTS (SELECT 1 FROM account_profiles a WHERE a.email = p.email)`).bind(hash, now),
        db.prepare("UPDATE pending_registrations SET member_id = last_insert_rowid() WHERE token_hash = ? AND changes() = 1 AND consumed_at IS NULL").bind(hash),
        db.prepare(`INSERT INTO member_accounts(member_id, username, password_hash, password_salt, password_iterations)
          SELECT member_id, username, password_hash, password_salt, password_iterations FROM pending_registrations
          WHERE token_hash = ? AND member_id IS NOT NULL AND consumed_at IS NULL`).bind(hash),
        db.prepare(`INSERT INTO account_profiles(member_id, email, verified_at, policy_version)
          SELECT member_id, email, ?, ? FROM pending_registrations WHERE token_hash = ? AND member_id IS NOT NULL AND consumed_at IS NULL`).bind(now, POLICY_VERSION, hash),
        db.prepare("UPDATE pending_registrations SET consumed_at = ?, password_hash = '', password_salt = '' WHERE token_hash = ? AND member_id IS NOT NULL AND consumed_at IS NULL").bind(now, hash),
      ]);
      if (result[0].meta.changes !== 1) throw invalidToken();
    } catch { throw invalidToken(); }
    return { ok: true };
  }
  const verification = await db.prepare("SELECT email FROM account_email_verifications WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ?").bind(hash, now).first<{ email: string }>();
  if (verification) requireTestEmail(verification.email);
  try {
    const result = await db.batch([
      db.prepare(`INSERT INTO account_profiles(member_id, email, verified_at, policy_version)
        SELECT v.member_id, v.email, ?, ? FROM account_email_verifications v JOIN member_accounts a ON a.member_id = v.member_id
        WHERE v.token_hash = ? AND v.consumed_at IS NULL AND v.expires_at > ? AND a.session_version = v.session_version
        AND NOT EXISTS (SELECT 1 FROM account_profiles p WHERE p.member_id = v.member_id OR p.email = v.email)`).bind(now, POLICY_VERSION, hash, now),
      db.prepare("UPDATE account_email_verifications SET consumed_at = ? WHERE token_hash = ? AND changes() = 1").bind(now, hash),
    ]);
    if (result[0].meta.changes !== 1) throw invalidToken();
  } catch { throw invalidToken(); }
  return { ok: true };
}

export async function requestRecovery(request: Request, emailInput: unknown) {
  const email = normalizeEmail(emailInput);
  if (!email) throw new ReadingGroupError("INVALID_EMAIL", 400, "Geçerli bir e-posta adresi gir.");
  requireTestEmail(email);
  await cleanup();
  const db = identityDatabase();
  const account = await db.prepare(`SELECT a.member_id AS memberId, a.session_version AS sessionVersion FROM account_profiles p
    JOIN member_accounts a ON a.member_id = p.member_id WHERE p.email = ?`).bind(email).first<{ memberId: number; sessionVersion: number }>();
  if (account) {
    const token = newToken();
    const hash = await tokenHash(token);
    await db.prepare("INSERT INTO account_recovery_tokens(token_hash, member_id, session_version, expires_at) VALUES (?, ?, ?, ?)")
      .bind(hash, account.memberId, account.sessionVersion, Date.now() + 15 * 60_000).run();
    try { await deliverAccountMail(request, email, "reset", token); }
    catch (error) { await db.prepare("DELETE FROM account_recovery_tokens WHERE token_hash = ?").bind(hash).run(); throw error; }
  }
  return { ok: true, message: genericMessage };
}

export async function resetAccountPassword(token: unknown, password: unknown) {
  if (typeof token !== "string" || !TOKEN_PATTERN.test(token) || typeof password !== "string") throw invalidToken();
  const db = identityDatabase();
  const hash = await tokenHash(token);
  const now = Date.now();
  const account = await db.prepare(`SELECT a.username, p.email FROM member_accounts a JOIN account_recovery_tokens t ON t.member_id = a.member_id
    JOIN account_profiles p ON p.member_id = a.member_id
    WHERE t.token_hash = ? AND t.consumed_at IS NULL AND t.expires_at > ? AND t.session_version = a.session_version`).bind(hash, now).first<{ username: string; email: string }>();
  if (!account) throw invalidToken();
  requireTestEmail(account.email);
  const issue = passwordValidationIssue(password, account.username);
  if (issue) throw new ReadingGroupError("INVALID_PASSWORD", 400, issue);
  const record = await hashPassword(password);
  const result = await db.batch([
    db.prepare(`UPDATE member_accounts SET password_hash = ?, password_salt = ?, password_iterations = ?, session_version = session_version + 1,
      failed_attempts = 0, locked_until = NULL, password_changed_at = CURRENT_TIMESTAMP
      WHERE member_id = (SELECT member_id FROM account_recovery_tokens WHERE token_hash = ? AND consumed_at IS NULL AND expires_at > ? AND session_version = member_accounts.session_version)`).bind(record.hash, record.salt, record.iterations, hash, now),
    db.prepare("UPDATE account_recovery_tokens SET consumed_at = ? WHERE token_hash = ? AND changes() = 1").bind(now, hash),
  ]);
  if (result[0].meta.changes !== 1) throw invalidToken();
  return { ok: true };
}

export async function verifiedAccount(memberId: number) {
  const account = await identityDatabase().prepare(`SELECT m.name, p.email FROM account_profiles p JOIN members m ON m.id = p.member_id WHERE p.member_id = ?`).bind(memberId).first<{ name: string; email: string }>();
  if (!account) throw new ReadingGroupError("EMAIL_VERIFICATION_REQUIRED", 403, "Önce hesabına bir e-posta adresi ekleyip doğrula.");
  requireTestEmail(account.email);
  return account;
}

export async function linkAccountEmail(request: Request, memberId: number, body: Record<string, unknown>) {
  const email = normalizeEmail(body.email);
  if (!email || typeof body.password !== "string" || body.password.length > 200) throw new ReadingGroupError("INVALID_EMAIL", 400, "E-posta ve mevcut şifreni kontrol et.");
  requireTestEmail(email);
  const db = identityDatabase();
  const row = await db.prepare("SELECT username FROM member_accounts WHERE member_id = ?").bind(memberId).first<{ username: string }>();
  const account = row ? await authenticateAccount(row.username, body.password) : null;
  if (!account || account.memberId !== memberId) throw new ReadingGroupError("INVALID_PASSWORD", 400, "Mevcut şifre yanlış.");
  if (await db.prepare("SELECT member_id FROM account_profiles WHERE member_id = ?").bind(memberId).first()) throw new ReadingGroupError("EMAIL_ALREADY_LINKED", 409, "Hesabının e-posta adresi zaten doğrulanmış.");
  if (!await db.prepare("SELECT member_id FROM account_profiles WHERE email = ?").bind(email).first()) {
    const token = newToken();
    const hash = await tokenHash(token);
    await db.prepare("INSERT INTO account_email_verifications(token_hash, member_id, email, session_version, expires_at) VALUES (?, ?, ?, ?, ?)")
      .bind(hash, memberId, email, account.sessionVersion, Date.now() + 30 * 60_000).run();
    await deliverAccountMail(request, email, "verify", token);
  }
  return { ok: true, message: genericMessage };
}
