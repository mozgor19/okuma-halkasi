import { identityDatabase, readingGroupContext } from "@/db/database";
import { getAuthenticatedMember } from "@/db/store";
import { noStore, readingGroupsEnabled, validGroupMode, validGroupScheme, withReadingGroup } from "@/lib/groups";
import type { ReadingGroupMode, ReadingGroupScheme } from "@/lib/types";

export const runtime = "edge";

export const PATCH = withReadingGroup(handlePATCH);

async function handlePATCH(request: Request) {
  if (!readingGroupsEnabled()) return noStore(Response.json({ error: "Sayfa bulunamadı." }, { status: 404 }));
  const context = readingGroupContext()!;
  const member = await getAuthenticatedMember(request);
  if (!member) return Response.json({ error: "Oturum gerekli." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Geçersiz görünüm tercihi." }, { status: 400 });
  }
  const { scheme, mode } = body as { scheme?: unknown; mode?: unknown };
  if ((scheme === undefined && mode === undefined)
    || (scheme !== undefined && !validGroupScheme(scheme))
    || (mode !== undefined && !validGroupMode(mode))
    || Object.keys(body).some((key) => key !== "scheme" && key !== "mode")) {
    return Response.json({ error: "Geçersiz görünüm tercihi." }, { status: 400 });
  }
  const updated = await identityDatabase().prepare(`
    UPDATE reading_group_memberships
    SET scheme = COALESCE(?, scheme), color_mode = COALESCE(?, color_mode)
    WHERE account_member_id = ? AND group_id = ? AND member_id = ? AND is_active = 1
    RETURNING scheme, color_mode AS mode
  `).bind(scheme ?? null, mode ?? null, context.accountMemberId, context.group.id, context.memberId)
    .first<{ scheme: ReadingGroupScheme; mode: ReadingGroupMode }>();
  if (!updated) {
    return Response.json({ error: "Bu okuma grubuna erişimin yok.", code: "GROUP_ACCESS_DENIED" }, { status: 403 });
  }
  return Response.json({ ok: true, group: { ...context.group, ...updated, role: member.role } });
}
