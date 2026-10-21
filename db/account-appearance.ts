import { identityDatabase } from "@/db/database";
import { ReadingGroupError, validGroupMode, validGroupScheme } from "@/lib/groups";
import { TOUR_VERSION } from "@/lib/web-experience-policy";
import type { SessionIdentity } from "@/lib/auth";
import type { ReadingGroupMode, ReadingGroupScheme } from "@/lib/types";

export type AccountAppearance = { scheme: ReadingGroupScheme; mode: ReadingGroupMode };

export async function accountAppearanceAvailable() {
  return !!await identityDatabase().prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='account_appearance'").first();
}

export async function readAccountAppearance(memberId: number): Promise<AccountAppearance | null> {
  if (!await accountAppearanceAvailable()) return null;
  return identityDatabase().prepare("SELECT scheme,color_mode AS mode FROM account_appearance WHERE member_id=?").bind(memberId).first<AccountAppearance>();
}

export async function initialAccountAppearance(memberId: number): Promise<AccountAppearance> {
  return await readAccountAppearance(memberId) ?? { scheme: "notebook", mode: "system" };
}

export async function saveAccountAppearance(identity: SessionIdentity, body: Record<string, unknown>, groupId: string | null) {
  if (!validGroupScheme(body.scheme) || !validGroupMode(body.mode)
    || Object.keys(body).some((key) => !["kind", "scheme", "mode", "groupId"].includes(key))) {
    throw new ReadingGroupError("INVALID_APPEARANCE", 400, "Görünüm ve renk modu seçimini kontrol et.");
  }
  if (!await accountAppearanceAvailable()) throw new ReadingGroupError("APPEARANCE_UNAVAILABLE", 503, "İlk görünüm seçimi henüz açılamadı. Daha sonra profilinden değiştirebilirsin.");
  const db = identityDatabase(), now = Date.now();
  // Account default, selected membership and tour completion commit together.
  // A concurrently revoked session or membership must not complete onboarding.
  const guard = `EXISTS (SELECT 1 FROM member_accounts WHERE member_id=? AND session_version=?)
    AND (? IS NULL OR EXISTS (SELECT 1 FROM reading_group_memberships WHERE account_member_id=? AND group_id=? AND is_active=1))`;
  const guarded = [identity.memberId, identity.sessionVersion, groupId, identity.memberId, groupId];
  const result = await db.batch([
    db.prepare(`INSERT INTO account_appearance(member_id,scheme,color_mode,updated_at)
      SELECT ?,?,?,? WHERE ${guard}
      ON CONFLICT(member_id) DO UPDATE SET scheme=excluded.scheme,color_mode=excluded.color_mode,updated_at=excluded.updated_at`)
      .bind(identity.memberId, body.scheme, body.mode, now, ...guarded),
    db.prepare(`UPDATE reading_group_memberships SET scheme=?,color_mode=?
      WHERE account_member_id=? AND group_id=? AND is_active=1 AND ${guard}`)
      .bind(body.scheme, body.mode, identity.memberId, groupId, ...guarded),
    db.prepare(`INSERT INTO account_experience(member_id,tour_version,tour_state,updated_at)
      SELECT ?,?,'completed',? WHERE ${guard}
      ON CONFLICT(member_id) DO UPDATE SET tour_version=excluded.tour_version,tour_state='completed',updated_at=excluded.updated_at`)
      .bind(identity.memberId, TOUR_VERSION, now, ...guarded),
  ]);
  if (result[0].meta.changes !== 1 || result[2].meta.changes !== 1 || (groupId && result[1].meta.changes !== 1)) {
    throw new ReadingGroupError("APPEARANCE_CONFLICT", 409, "Hesap veya grup erişimin değişti. Sayfayı yenileyip yeniden dene.");
  }
}
