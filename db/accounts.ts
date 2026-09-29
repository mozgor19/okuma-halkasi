import { database } from "@/db/database";
import {
  authenticateLegacyMember,
  legacyUsernameForMember,
  type SessionIdentity,
} from "@/lib/auth";
import {
  hashPassword,
  normalizeUsername,
  passwordIterationsSupported,
  passwordValidationIssue,
  verifyPassword,
} from "@/lib/password";

type AccountRow = {
  memberId: number;
  username: string;
  passwordHash: string;
  passwordSalt: string;
  passwordIterations: number;
  sessionVersion: number;
  failedAttempts: number;
  lockedUntil: string | null;
};

export type AccountSession = { memberId: number; sessionVersion: number };
const PASSWORD_REHASH_REQUIRED = "PASSWORD_REHASH_REQUIRED";

export function passwordRehashRequired(error: unknown): boolean {
  return error instanceof Error && error.message === PASSWORD_REHASH_REQUIRED;
}
export type ChangePasswordResult =
  | { ok: true; sessionVersion: number }
  | { ok: false; reason: "invalid-current" | "invalid-new" | "migration-required"; error: string };

const accountSelect = `
  SELECT
    member_id AS memberId,
    username,
    password_hash AS passwordHash,
    password_salt AS passwordSalt,
    password_iterations AS passwordIterations,
    session_version AS sessionVersion,
    failed_attempts AS failedAttempts,
    locked_until AS lockedUntil
  FROM member_accounts
`;

function accountTableMissing(error: unknown): boolean {
  return error instanceof Error && /no such table:\s*member_accounts/i.test(error.message);
}

async function accountByUsername(username: string): Promise<AccountRow | null> {
  return database().prepare(accountSelect + " WHERE username = ?").bind(username).first<AccountRow>();
}

async function accountByMemberId(memberId: number): Promise<AccountRow | null> {
  return database().prepare(accountSelect + " WHERE member_id = ?").bind(memberId).first<AccountRow>();
}

async function replaceAccountPassword(account: AccountRow, password: string): Promise<AccountSession> {
  const passwordRecord = await hashPassword(password);
  await database().prepare(
    "UPDATE member_accounts SET password_hash = ?, password_salt = ?, password_iterations = ?, failed_attempts = 0, locked_until = NULL, password_changed_at = CURRENT_TIMESTAMP WHERE member_id = ?",
  ).bind(
    passwordRecord.hash,
    passwordRecord.salt,
    passwordRecord.iterations,
    account.memberId,
  ).run();
  return { memberId: account.memberId, sessionVersion: account.sessionVersion };
}

async function migrateLegacyAccount(username: string, password: string, memberId: number): Promise<AccountSession> {
  const passwordRecord = await hashPassword(password);
  await database().prepare(`
    INSERT INTO member_accounts (
      member_id, username, password_hash, password_salt, password_iterations
    ) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT DO NOTHING
  `).bind(
    memberId,
    username,
    passwordRecord.hash,
    passwordRecord.salt,
    passwordRecord.iterations,
  ).run();

  const account = await accountByMemberId(memberId);
  if (!account || account.username !== username) throw new Error("Hesap taşınamadı.");
  return { memberId: account.memberId, sessionVersion: account.sessionVersion };
}

export async function authenticateAccount(usernameInput: string, password: string): Promise<AccountSession | null> {
  const username = normalizeUsername(usernameInput);
  let account: AccountRow | null;
  let tableAvailable = true;

  try {
    account = await accountByUsername(username);
  } catch (error) {
    if (!accountTableMissing(error)) throw error;
    account = null;
    tableAvailable = false;
  }

  if (account) {
    if (account.lockedUntil && Date.parse(account.lockedUntil) > Date.now()) return null;
    if (!passwordIterationsSupported(account.passwordIterations)) {
      const legacyMemberId = await authenticateLegacyMember(username, password);
      if (legacyMemberId !== account.memberId) throw new Error(PASSWORD_REHASH_REQUIRED);
      return replaceAccountPassword(account, password);
    }
    const valid = await verifyPassword(
      password,
      account.passwordHash,
      account.passwordSalt,
      account.passwordIterations,
    );
    if (!valid) {
      const failedAttempts = account.failedAttempts + 1;
      const lockedUntil = failedAttempts >= 5
        ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
        : null;
      await database().prepare(
        "UPDATE member_accounts SET failed_attempts = ?, locked_until = ? WHERE member_id = ?",
      ).bind(failedAttempts, lockedUntil, account.memberId).run();
      return null;
    }

    if (account.failedAttempts || account.lockedUntil) {
      await database().prepare(
        "UPDATE member_accounts SET failed_attempts = 0, locked_until = NULL WHERE member_id = ?",
      ).bind(account.memberId).run();
    }
    return { memberId: account.memberId, sessionVersion: account.sessionVersion };
  }

  const memberId = await authenticateLegacyMember(username, password);
  if (!memberId) return null;
  if (!tableAvailable) return { memberId, sessionVersion: 0 };
  return migrateLegacyAccount(username, password, memberId);
}

export async function sessionAccountIsCurrent(identity: SessionIdentity): Promise<boolean> {
  try {
    const account = await accountByMemberId(identity.memberId);
    return account
      ? account.sessionVersion === identity.sessionVersion
      : identity.sessionVersion === 0;
  } catch (error) {
    if (accountTableMissing(error)) return identity.sessionVersion === 0;
    throw error;
  }
}

export async function changeMemberPassword(
  memberId: number,
  currentPassword: string,
  newPassword: string,
): Promise<ChangePasswordResult> {
  let account: AccountRow | null;
  try {
    account = await accountByMemberId(memberId);
  } catch (error) {
    if (accountTableMissing(error)) {
      return {
        ok: false,
        reason: "migration-required",
        error: "Parola değiştirmek için önce 0002 hesap migration'ını D1 veritabanına uygula.",
      };
    }
    throw error;
  }

  let username: string;
  let nextVersion: number;
  if (account) {
    if (!passwordIterationsSupported(account.passwordIterations)) {
      const legacyUsername = await legacyUsernameForMember(memberId, currentPassword);
      if (legacyUsername !== account.username) {
        return {
          ok: false,
          reason: "migration-required",
          error: "Bu hesabın parola kaydı güncellenmeli. MEMBER_CREDENTIALS Secret'ını geçici olarak geri ekleyip yeniden giriş yap.",
        };
      }
    } else {
      const valid = await verifyPassword(
        currentPassword,
        account.passwordHash,
        account.passwordSalt,
        account.passwordIterations,
      );
      if (!valid) {
        return { ok: false, reason: "invalid-current", error: "Mevcut şifre yanlış." };
      }
    }
    username = account.username;
    nextVersion = account.sessionVersion + 1;
  } else {
    const legacyUsername = await legacyUsernameForMember(memberId, currentPassword);
    if (!legacyUsername) {
      return { ok: false, reason: "invalid-current", error: "Mevcut şifre yanlış." };
    }
    username = legacyUsername;
    nextVersion = 1;
  }

  if (newPassword === currentPassword) {
    return { ok: false, reason: "invalid-new", error: "Yeni şifre mevcut şifreden farklı olmalı." };
  }
  const validationIssue = passwordValidationIssue(newPassword, username);
  if (validationIssue) {
    return { ok: false, reason: "invalid-new", error: validationIssue };
  }

  const passwordRecord = await hashPassword(newPassword);
  await database().prepare(`
    INSERT INTO member_accounts (
      member_id, username, password_hash, password_salt, password_iterations,
      session_version, failed_attempts, locked_until, password_changed_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, NULL, CURRENT_TIMESTAMP)
    ON CONFLICT(member_id) DO UPDATE SET
      password_hash = excluded.password_hash,
      password_salt = excluded.password_salt,
      password_iterations = excluded.password_iterations,
      session_version = excluded.session_version,
      failed_attempts = 0,
      locked_until = NULL,
      password_changed_at = CURRENT_TIMESTAMP
  `).bind(
    memberId,
    username,
    passwordRecord.hash,
    passwordRecord.salt,
    passwordRecord.iterations,
    nextVersion,
  ).run();

  return { ok: true, sessionVersion: nextVersion };
}
