import { identityDatabase } from "@/db/database";

export async function accountErasureBlocked(memberId: number): Promise<boolean> {
  const db = identityDatabase();
  const available = await db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'account_erasure_jobs'").first();
  if (!available) return false;
  return !!await db.prepare("SELECT 1 FROM account_erasure_jobs WHERE account_member_id = ?").bind(memberId).first();
}
