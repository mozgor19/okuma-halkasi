import { env } from "cloudflare:workers";
import { sessionAccountIsCurrent } from "@/db/accounts";
import {
  identityDatabase,
  readingGroupsEnabled,
  runWithReadingGroup,
  type ReadingGroupContext,
} from "@/db/database";
import { SESSION_MAX_AGE, sessionIdentity, sessionTokenFromRequest } from "@/lib/auth";
import type { Member, ReadingGroup, ReadingGroupMembership, ReadingGroupMode, ReadingGroupScheme } from "@/lib/types";

export { readingGroupsEnabled } from "@/db/database";
export const READING_GROUP_COOKIE = "okuma_group";

type MembershipRow = ReadingGroup & { memberId: number; bindingName: string };
type ResolvedGroup = { context: ReadingGroupContext; group: ReadingGroupMembership };

export class ReadingGroupError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
  }
}

export function noStore<T extends Response>(response: T): T {
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export function readingGroupErrorResponse(error: unknown): Response {
  if (error instanceof ReadingGroupError) {
    return noStore(Response.json({ error: error.message, code: error.code }, { status: error.status }));
  }
  console.error("Reading group unavailable", error);
  return noStore(Response.json(
    { error: "Okuma gruplarına şu anda ulaşılamıyor.", code: "GROUP_UNAVAILABLE" },
    { status: 503 },
  ));
}

export function validGroupId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}$/.test(value);
}

export function validGroupScheme(value: unknown): value is ReadingGroupScheme {
  return typeof value === "string" && ["editorial", "catalogue", "notebook", "minimal"].includes(value);
}

export function validGroupMode(value: unknown): value is ReadingGroupMode {
  return typeof value === "string" && ["light", "dark", "system"].includes(value);
}

export function groupCookieFromRequest(request: Request): string | null {
  const cookies = request.headers.get("cookie")?.split(";")
    .map((part) => part.trim()).filter((part) => part.startsWith(`${READING_GROUP_COOKIE}=`)) ?? [];
  if (!cookies.length) return null;
  // An invalid or duplicate cookie is a selection, never a reason to auto-select another group.
  if (cookies.length !== 1) return "";
  try {
    return decodeURIComponent(cookies[0].slice(READING_GROUP_COOKIE.length + 1));
  } catch {
    return "";
  }
}

export function groupCookieOptions(request: Request, clear = false) {
  return {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax" as const,
    path: "/",
    maxAge: clear ? 0 : SESSION_MAX_AGE,
  };
}

export async function requireAccountIdentity(request: Request) {
  const identity = await sessionIdentity(sessionTokenFromRequest(request));
  if (!identity || !(await sessionAccountIsCurrent(identity))) {
    throw new ReadingGroupError("UNAUTHORIZED", 401, "Oturum gerekli.");
  }
  return identity;
}

async function membershipsForAccount(accountMemberId: number): Promise<MembershipRow[]> {
  const db = identityDatabase();
  const member = await db.prepare("SELECT id FROM members WHERE id = ? AND is_guest = 0")
    .bind(accountMemberId).first();
  if (!member) throw new ReadingGroupError("GROUP_ACCESS_DENIED", 403, "Bu okuma grubuna erişimin yok.");
  const { results } = await db.prepare(`
    SELECT g.id, g.name, g.binding_name AS bindingName, m.member_id AS memberId,
      m.scheme, m.color_mode AS mode
    FROM reading_group_memberships m JOIN reading_groups g ON g.id = m.group_id
    WHERE m.account_member_id = ? AND m.is_active = 1 ORDER BY g.name, g.id
  `).bind(accountMemberId).all<MembershipRow>();
  if (!results.length) throw new ReadingGroupError("GROUP_ACCESS_DENIED", 403, "Henüz erişebildiğin bir okuma grubu yok.");
  return results;
}

function groupDatabase(group: MembershipRow): D1Database {
  if (!validGroupId(group.id) || !validGroupScheme(group.scheme) || !validGroupMode(group.mode)
    || !Number.isSafeInteger(group.memberId) || group.memberId < 1) {
    throw new ReadingGroupError("GROUP_UNAVAILABLE", 503, "Okuma grubu yapılandırması geçersiz.");
  }
  if (group.id === "default" && group.bindingName === "DB") return identityDatabase();
  if (group.id === "default" || group.bindingName === "DB") {
    throw new ReadingGroupError("GROUP_UNAVAILABLE", 503, "Okuma grubunun veritabanı bağlantısı geçersiz.");
  }
  let allowed: unknown;
  try {
    allowed = JSON.parse(env.READING_GROUP_DB_BINDINGS ?? "[]");
  } catch {
    throw new ReadingGroupError("GROUP_UNAVAILABLE", 503, "İzin verilen grup veritabanları yapılandırması geçersiz.");
  }
  if (!Array.isArray(allowed) || !allowed.every((name) => typeof name === "string" && /^[A-Z][A-Z0-9_]*$/.test(name))
    || !allowed.includes(group.bindingName)) {
    throw new ReadingGroupError("GROUP_UNAVAILABLE", 503, "Okuma grubunun veritabanı bağlantısına izin verilmemiş.");
  }
  const bindings = env as unknown as Record<string, unknown>;
  const db = Object.hasOwn(bindings, group.bindingName) ? bindings[group.bindingName] as D1Database | undefined : undefined;
  if (!db || db === identityDatabase() || typeof db.prepare !== "function" || typeof db.batch !== "function") {
    throw new ReadingGroupError("GROUP_UNAVAILABLE", 503, "Okuma grubunun veritabanına ulaşılamıyor.");
  }
  return db;
}

async function resolveMembership(accountMemberId: number, membership: MembershipRow): Promise<ResolvedGroup> {
  const db = groupDatabase(membership);
  const member = await db.prepare("SELECT role FROM members WHERE id = ? AND is_guest = 0")
    .bind(membership.memberId).first<{ role: Member["role"] }>();
  if (!member || !["member", "admin", "super_admin"].includes(member.role)) {
    throw new ReadingGroupError("GROUP_ACCESS_DENIED", 403, "Bu okuma grubuna erişimin yok.");
  }
  const { id, name, scheme, mode } = membership;
  const group = { id, name, scheme, mode };
  return {
    context: { db, accountMemberId, memberId: membership.memberId, group },
    group: { ...group, role: member.role },
  };
}

export async function accountReadingGroups(accountMemberId: number): Promise<ReadingGroupMembership[]> {
  const memberships = await membershipsForAccount(accountMemberId);
  return Promise.all(memberships.map(async (membership) => (await resolveMembership(accountMemberId, membership)).group));
}

export function selectedGroupId(request: Request, groups: Array<{ id: string }>): string | null {
  const cookie = groupCookieFromRequest(request);
  if (cookie !== null) return groups.some((group) => group.id === cookie) ? cookie : null;
  return groups.length === 1 ? groups[0].id : null;
}

export async function resolveReadingGroup(request: Request): Promise<ResolvedGroup> {
  const identity = await requireAccountIdentity(request);
  const memberships = await membershipsForAccount(identity.memberId);
  const cookie = groupCookieFromRequest(request);
  if (cookie === null && memberships.length > 1) {
    throw new ReadingGroupError("GROUP_SELECTION_REQUIRED", 409, "Devam etmek için bir okuma grubu seç.");
  }
  const membership = cookie === null ? memberships[0] : memberships.find((group) => group.id === cookie);
  if (!membership) throw new ReadingGroupError("GROUP_ACCESS_DENIED", 403, "Bu okuma grubuna erişimin yok.");
  verifyRequestGroup(request, membership.id);
  return resolveMembership(identity.memberId, membership);
}

export async function selectReadingGroup(request: Request, groupId: string): Promise<ReadingGroupMembership> {
  const identity = await requireAccountIdentity(request);
  const memberships = await membershipsForAccount(identity.memberId);
  const membership = memberships.find((group) => group.id === groupId);
  if (!membership) throw new ReadingGroupError("GROUP_ACCESS_DENIED", 403, "Bu okuma grubuna erişimin yok.");
  verifyRequestGroup(request, groupId);
  return (await resolveMembership(identity.memberId, membership)).group;
}

export function verifyRequestGroup(request: Request, groupId: string) {
  const mutation = !["GET", "HEAD", "OPTIONS"].includes(request.method.toUpperCase());
  const header = request.headers.get("X-Reading-Group");
  const query = new URL(request.url).searchParams.getAll("group");
  if ((mutation || header !== null) && header !== groupId
    || query.length > 1 || query.some((value) => value !== groupId)) {
    throw new ReadingGroupError("GROUP_CHANGED", 409, "Okuma grubu değişti. Devam etmeden önce grubu yeniden seç.");
  }
  if (mutation && request.headers.get("origin") !== new URL(request.url).origin) {
    throw new ReadingGroupError("INVALID_ORIGIN", 403, "Geçersiz istek kaynağı.");
  }
}

export function verifyLegacyGroup(request: Request) {
  const header = request.headers.get("X-Reading-Group");
  const query = new URL(request.url).searchParams.getAll("group");
  if ((header !== null && header !== "default") || query.length > 1 || query.some((id) => id !== "default")) {
    throw new ReadingGroupError("GROUP_DISABLED", 503, "Bu okuma grubu şu anda etkin değil.");
  }
}

async function hasGroupRegistry() {
  return !!await identityDatabase().prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'reading_group_memberships'").first();
}

async function defaultMembership(accountMemberId: number) {
  const membership = await identityDatabase().prepare(`
    SELECT g.id, g.name, g.binding_name AS bindingName, m.member_id AS memberId, m.scheme, m.color_mode AS mode
    FROM reading_group_memberships m JOIN reading_groups g ON g.id = m.group_id
    WHERE m.account_member_id = ? AND m.group_id = 'default' AND m.is_active = 1
  `).bind(accountMemberId).first<MembershipRow>();
  if (!membership) throw new ReadingGroupError("GROUP_ACCESS_DENIED", 403, "Bu okuma grubuna erişimin yok.");
  return resolveMembership(accountMemberId, membership);
}

export async function legacyAccountReadingGroup(accountMemberId: number) {
  return await hasGroupRegistry() ? defaultMembership(accountMemberId) : null;
}

export async function resolveLegacyReadingGroup(request: Request) {
  verifyLegacyGroup(request);
  if (!await hasGroupRegistry()) return null;
  const identity = await requireAccountIdentity(request);
  return defaultMembership(identity.memberId);
}

export function withReadingGroup<Args extends unknown[]>(handler: (request: Request, ...args: Args) => Promise<Response>) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    if (!readingGroupsEnabled()) {
      try {
        const resolved = await resolveLegacyReadingGroup(request);
        if (resolved) return noStore(await runWithReadingGroup(resolved.context, () => handler(request, ...args)));
      }
      catch (error) { return readingGroupErrorResponse(error); }
      return handler(request, ...args);
    }
    try {
      const { context } = await resolveReadingGroup(request);
      return noStore(await runWithReadingGroup(context, () => handler(request, ...args)));
    } catch (error) {
      return readingGroupErrorResponse(error);
    }
  };
}
