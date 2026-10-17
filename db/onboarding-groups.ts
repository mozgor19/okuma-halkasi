import { env } from "cloudflare:workers";
import { identityDatabase } from "@/db/database";
import { verifiedAccount } from "@/db/onboarding-accounts";
import { accountReadingGroups, groupDatabase, ReadingGroupError, resolveReadingGroup } from "@/lib/groups";
import { bindingNames, cleanName, newToken, REQUEST_KEY_PATTERN, TOKEN_PATTERN, tokenHash } from "@/lib/onboarding-policy";

type GroupRow = { id: string; name: string; bindingName: string };
const unavailable = () => new ReadingGroupError("GROUP_CAPACITY", 503, "Şu anda yeni grup için kapasite yok. Daha sonra tekrar dene veya destekle iletişime geç.");
const invalidInvite = () => new ReadingGroupError("INVALID_INVITATION", 400, "Davet geçersiz, iptal edilmiş, dolmuş veya kullanım sınırına ulaşmış.");
function domainDb(group: GroupRow) { return groupDatabase({ ...group, memberId: 1, scheme: "notebook", mode: "system" }); }

async function localMember(db: D1Database, groupId: string, accountId: number, name: string, role: "member" | "super_admin") {
  await db.prepare("INSERT INTO group_database_ownership(singleton, group_id) VALUES (1, ?) ON CONFLICT DO NOTHING").bind(groupId).run();
  const owner = await db.prepare("SELECT group_id AS groupId FROM group_database_ownership WHERE singleton = 1").first<{ groupId: string }>();
  if (owner?.groupId !== groupId) throw new ReadingGroupError("GROUP_DATABASE_CONFLICT", 503, "Grubun veri bağlantısı doğrulanamadı. Destekle iletişime geç.");
  // A transaction in the domain DB gives each account exactly one local member on retries.
  await db.batch([
    db.prepare("INSERT INTO members(name, role) SELECT ?, ? WHERE NOT EXISTS (SELECT 1 FROM group_account_links WHERE account_member_id = ?)").bind(name, role, accountId),
    db.prepare("INSERT INTO group_account_links(account_member_id, member_id) SELECT ?, last_insert_rowid() WHERE changes() = 1").bind(accountId),
  ]);
  const link = await db.prepare("SELECT member_id AS memberId FROM group_account_links WHERE account_member_id = ?").bind(accountId).first<{ memberId: number }>();
  if (!link) throw new Error("Group member provisioning unavailable.");
  return link.memberId;
}

export async function createReadingGroup(accountId: number, body: Record<string, unknown>) {
  const account = await verifiedAccount(accountId);
  const name = cleanName(body.name);
  if (!name || typeof body.requestKey !== "string" || !REQUEST_KEY_PATTERN.test(body.requestKey)) throw new ReadingGroupError("INVALID_GROUP", 400, "Grup adını kontrol et (2–100 karakter).");
  const db = identityDatabase();
  const existing = () => db.prepare(`SELECT g.id, g.name, g.binding_name AS bindingName FROM group_provisioning p JOIN reading_groups g ON g.id = p.group_id
    WHERE p.owner_id = ? AND p.request_key = ?`).bind(accountId, body.requestKey).first<GroupRow>();
  let group = await existing();
  if (group && group.name !== name) throw new ReadingGroupError("REQUEST_CONFLICT", 409, "Bu işlem başka bir grup adıyla başlatılmış. Sayfayı yenile.");
  if (!group) {
    const pool = bindingNames(env.SELF_SERVICE_GROUP_BINDINGS);
    const allowed = bindingNames(env.READING_GROUP_DB_BINDINGS);
    for (const bindingName of pool) {
      if (!allowed.includes(bindingName)) throw unavailable();
      if (await db.prepare("SELECT id FROM reading_groups WHERE binding_name = ?").bind(bindingName).first()) continue;
      const id = crypto.randomUUID();
      const candidate = { id, name, bindingName };
      const domain = domainDb(candidate);
      // Never allocate a seeded or partially migrated database to a new group.
      const inventory = await domain.batch(["members", "books", "meetings", "attendance", "reviews", "media", "photos", "roadmap",
        "favorite_books", "book_votes", "meeting_rsvps", "group_account_links", "group_database_ownership"]
        .map((table) => domain.prepare(`SELECT 1 FROM ${table} LIMIT 1`)).concat([
          // Migration 0005 installs this factory default even in an otherwise empty database.
          domain.prepare("SELECT 1 FROM club_settings WHERE key <> 'book_vote_visibility' OR value <> 'open' LIMIT 1"),
        ]));
      if (inventory.some((result) => result.results.length > 0)) continue;
      try {
        await db.batch([
          db.prepare(`INSERT INTO reading_groups(id, name, binding_name) SELECT ?, ?, ?
            WHERE NOT EXISTS (SELECT 1 FROM group_provisioning WHERE owner_id = ? AND request_key = ?)
            AND (SELECT count(*) FROM group_provisioning WHERE owner_id = ?) < 3`).bind(id, name, bindingName, accountId, body.requestKey, accountId),
          db.prepare("INSERT INTO group_provisioning(group_id, owner_id, request_key, created_at) SELECT id, ?, ?, ? FROM reading_groups WHERE id = ?")
            .bind(accountId, body.requestKey, Date.now(), id),
        ]);
      } catch (error) {
        // A simultaneous request can reserve this binding first. Other errors must fail closed.
        if (!(error instanceof Error) || !/UNIQUE constraint failed: reading_groups.binding_name|UNIQUE constraint failed: group_provisioning.owner_id, group_provisioning.request_key/.test(error.message)) throw error;
      }
      group = await existing();
      if (group) break;
    }
  }
  if (!group) throw unavailable();
  const memberId = await localMember(domainDb(group), group.id, accountId, account.name, "super_admin");
  await db.batch([
    db.prepare("INSERT INTO reading_group_memberships(account_member_id, group_id, member_id) VALUES (?, ?, ?) ON CONFLICT(account_member_id, group_id) DO NOTHING").bind(accountId, group.id, memberId),
    db.prepare("UPDATE group_provisioning SET state = 'ready' WHERE group_id = ? AND owner_id = ?").bind(group.id, accountId),
  ]);
  return { ok: true, group: (await accountReadingGroups(accountId)).find((item) => item.id === group!.id) };
}

export async function manageInvitations(request: Request, action: "list" | "create" | "revoke", body: Record<string, unknown> = {}) {
  const { context, group } = await resolveReadingGroup(request);
  if (!["super_admin", "admin"].includes(group.role)) throw new ReadingGroupError("FORBIDDEN", 403, "Davetleri yalnız yöneticiler yönetebilir.");
  const db = identityDatabase();
  if (action === "list") {
    const { results } = await db.prepare(`SELECT i.id, i.created_at AS createdAt, i.expires_at AS expiresAt, i.max_uses AS maxUses, i.revoked_at AS revokedAt,
      (SELECT count(*) FROM group_invitation_redemptions r WHERE r.invitation_id = i.id) AS uses
      FROM group_invitations i WHERE i.group_id = ? ORDER BY i.created_at DESC LIMIT 50`).bind(group.id).all();
    return { invitations: results };
  }
  if (action === "revoke") {
    if (typeof body.id !== "string" || !REQUEST_KEY_PATTERN.test(body.id)) throw invalidInvite();
    await db.prepare("UPDATE group_invitations SET revoked_at = ? WHERE id = ? AND group_id = ? AND revoked_at IS NULL").bind(Date.now(), body.id, group.id).run();
    return { ok: true };
  }
  await verifiedAccount(context.accountMemberId);
  const maxUses = body.maxUses ?? 10;
  const days = body.days ?? 7;
  if (!Number.isInteger(maxUses) || Number(maxUses) < 1 || Number(maxUses) > 100 || !Number.isInteger(days) || Number(days) < 1 || Number(days) > 30) throw new ReadingGroupError("INVALID_INVITATION", 400, "Davet süresi veya kullanım sınırı geçersiz.");
  const token = newToken();
  const id = crypto.randomUUID();
  const expiresAt = Date.now() + Number(days) * 86_400_000;
  const result = await db.prepare(`INSERT INTO group_invitations(id, group_id, token_hash, created_by, created_at, expires_at, max_uses)
    SELECT ?, ?, ?, ?, ?, ?, ? WHERE (SELECT count(*) FROM group_invitations WHERE group_id = ? AND revoked_at IS NULL AND expires_at > ?) < 20`)
    .bind(id, group.id, await tokenHash(token), context.accountMemberId, Date.now(), expiresAt, maxUses, group.id, Date.now()).run();
  if (result.meta.changes !== 1) throw new ReadingGroupError("INVITATION_LIMIT", 409, "Aktif davet sınırına ulaşıldı. Önce eski bir daveti iptal et.");
  return { ok: true, id, token, expiresAt, maxUses };
}

export async function reserveInvitation(accountId: number, invitationId: string, now: number) {
  return identityDatabase().prepare(`INSERT INTO group_invitation_redemptions(account_member_id, group_id, invitation_id, created_at)
    SELECT ?, group_id, id, ? FROM group_invitations i WHERE i.id = ? AND revoked_at IS NULL AND expires_at > ?
    AND (SELECT count(*) FROM group_invitation_redemptions r WHERE r.invitation_id = i.id) < max_uses
    AND (SELECT count(*) FROM (SELECT group_id FROM reading_group_memberships WHERE account_member_id = ?
      UNION SELECT group_id FROM group_invitation_redemptions WHERE account_member_id = ?)) < 20
    ON CONFLICT(account_member_id, group_id) DO NOTHING`).bind(accountId, now, invitationId, now, accountId, accountId).run();
}

export async function joinReadingGroup(accountId: number, value: unknown) {
  const account = await verifiedAccount(accountId);
  if (typeof value !== "string" || !TOKEN_PATTERN.test(value)) throw invalidInvite();
  const db = identityDatabase();
  const now = Date.now();
  const invite = await db.prepare(`SELECT i.id AS invitationId, g.id, g.name, g.binding_name AS bindingName FROM group_invitations i
    JOIN reading_groups g ON g.id = i.group_id WHERE i.token_hash = ? AND i.revoked_at IS NULL AND i.expires_at > ?`)
    .bind(await tokenHash(value), now).first<GroupRow & { invitationId: string }>();
  if (!invite) throw invalidInvite();
  const membership = await db.prepare("SELECT is_active AS active FROM reading_group_memberships WHERE account_member_id = ? AND group_id = ?").bind(accountId, invite.id).first<{ active: number }>();
  if (membership?.active === 0) throw new ReadingGroupError("MEMBERSHIP_REVOKED", 403, "Bu gruptaki üyeliğin kapatılmış. Grubun yöneticisiyle iletişime geç.");
  if (!membership) {
    await reserveInvitation(accountId, invite.invitationId, now);
    const reservation = await db.prepare("SELECT invitation_id AS invitationId FROM group_invitation_redemptions WHERE account_member_id = ? AND group_id = ?").bind(accountId, invite.id).first<{ invitationId: string }>();
    if (!reservation || reservation.invitationId !== invite.invitationId) throw invalidInvite();
    const memberId = invite.id === "default" ? accountId : await localMember(domainDb(invite), invite.id, accountId, account.name, "member");
    const result = await db.batch([
      db.prepare(`INSERT INTO reading_group_memberships(account_member_id, group_id, member_id)
        SELECT ?, i.group_id, ? FROM group_invitations i WHERE i.id = ? AND i.revoked_at IS NULL AND i.expires_at > ?
        AND EXISTS (SELECT 1 FROM group_invitation_redemptions r WHERE r.account_member_id = ? AND r.group_id = i.group_id AND r.invitation_id = i.id)
        ON CONFLICT(account_member_id, group_id) DO NOTHING`).bind(accountId, memberId, invite.invitationId, Date.now(), accountId),
      db.prepare(`UPDATE group_invitation_redemptions SET state = 'ready' WHERE account_member_id = ? AND group_id = ?
        AND EXISTS (SELECT 1 FROM reading_group_memberships m WHERE m.account_member_id = ? AND m.group_id = ? AND m.is_active = 1)`).bind(accountId, invite.id, accountId, invite.id),
    ]);
    if (!result[0].meta.changes && !await db.prepare("SELECT member_id FROM reading_group_memberships WHERE account_member_id = ? AND group_id = ? AND is_active = 1").bind(accountId, invite.id).first()) throw invalidInvite();
  }
  return { ok: true, group: (await accountReadingGroups(accountId)).find((item) => item.id === invite.id) };
}
