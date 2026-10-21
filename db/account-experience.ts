import { identityDatabase } from "@/db/database";
import { authenticateAccount } from "@/db/accounts";
import { ReadingGroupError } from "@/lib/groups";
import { TOUR_VERSION, validTourState } from "@/lib/web-experience-policy";
import type { SessionIdentity } from "@/lib/auth";
import { accountAppearanceAvailable, readAccountAppearance } from "@/db/account-appearance";

export async function accountExperienceAvailable() {
  const { results } = await identityDatabase().prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('account_experience', 'account_deletion_requests')").all();
  return results.length === 2;
}

export async function readAccountExperience(memberId: number) {
  if (!await accountExperienceAvailable()) return { available: false };
  const db = identityDatabase();
  const profile = await db.prepare("SELECT member_id FROM account_profiles WHERE member_id = ?").bind(memberId).first();
  const tour = await db.prepare("SELECT tour_version AS version, tour_state AS state FROM account_experience WHERE member_id = ?").bind(memberId).first();
  const deletion = await db.prepare("SELECT id, status, requested_at AS requestedAt FROM account_deletion_requests WHERE member_id = ?").bind(memberId).first();
  const appearanceAvailable = await accountAppearanceAvailable();
  const appearance = appearanceAvailable ? await readAccountAppearance(memberId) : null;
  return { available: true, tourEligible: !!profile, tour, deletion, appearanceAvailable, appearance };
}

export async function saveAccountTour(memberId: number, body: Record<string, unknown>) {
  if (body.version !== TOUR_VERSION || !validTourState(body.state)) throw new ReadingGroupError("INVALID_TOUR", 400, "İlk adımlar kaydı geçersiz.");
  await identityDatabase().prepare(`INSERT INTO account_experience(member_id, tour_version, tour_state, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(member_id) DO UPDATE SET tour_version = excluded.tour_version, tour_state = excluded.tour_state, updated_at = excluded.updated_at`)
    .bind(memberId, TOUR_VERSION, body.state, Date.now()).run();
  return { ok: true };
}

export async function changeDeletionRequest(identity: SessionIdentity, body: Record<string, unknown>) {
  if (!["request", "cancel"].includes(String(body.action)) || typeof body.password !== "string" || !body.password || body.password.length > 200
    || (body.action === "request" && body.confirmed !== true)) throw new ReadingGroupError("INVALID_REQUEST", 400, "Şifreni ve silme talebi onayını kontrol et.");
  const db = identityDatabase();
  const row = await db.prepare("SELECT username FROM member_accounts WHERE member_id = ?").bind(identity.memberId).first<{ username: string }>();
  const authenticated = row ? await authenticateAccount(row.username, body.password) : null;
  if (!authenticated || authenticated.memberId !== identity.memberId || authenticated.sessionVersion !== identity.sessionVersion) {
    throw new ReadingGroupError("INVALID_PASSWORD", 400, "Mevcut şifre doğrulanamadı. Bilgilerini kontrol et.");
  }
  const now = Date.now();
  if (body.action === "request") {
    // Retries return the same active request. No group/identity data is erased here.
    await db.prepare(`INSERT INTO account_deletion_requests(id, member_id, requested_at, updated_at)
      SELECT ?, member_id, ?, ? FROM member_accounts WHERE member_id = ? AND session_version = ?
      ON CONFLICT(member_id) DO UPDATE SET status = 'requested', requested_at = excluded.requested_at, updated_at = excluded.updated_at
      WHERE account_deletion_requests.status = 'cancelled'`)
      .bind(crypto.randomUUID(), now, now, identity.memberId, identity.sessionVersion).run();
  } else {
    await db.prepare(`UPDATE account_deletion_requests SET status = 'cancelled', updated_at = ? WHERE member_id = ? AND status = 'requested'
      AND EXISTS (SELECT 1 FROM member_accounts WHERE member_id = ? AND session_version = ?)`)
      .bind(now, identity.memberId, identity.memberId, identity.sessionVersion).run();
  }
  const result = await readAccountExperience(identity.memberId);
  const request = result.deletion as { status?: string } | null | undefined;
  if (!request || (body.action === "cancel" && request.status !== "cancelled") || request.status === "completed") {
    throw new ReadingGroupError("REQUEST_CONFLICT", 409, "Talebin durumu değişti. Sayfayı yenile veya destekle iletişime geç.");
  }
  return { ok: true, ...result };
}
