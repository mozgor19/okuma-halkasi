import { NextResponse } from "next/server";
import {
  accountReadingGroups,
  groupCookieOptions,
  noStore,
  READING_GROUP_COOKIE,
  readingGroupErrorResponse,
  readingGroupsEnabled,
  requireAccountIdentity,
  selectedGroupId,
  selectReadingGroup,
  validGroupId,
} from "@/lib/groups";
import type { ReadingGroupsResponse } from "@/lib/types";

export const runtime = "edge";

export async function GET(request: Request) {
  if (!readingGroupsEnabled()) {
    return noStore(Response.json({ enabled: false, groups: [], selectedGroupId: null } satisfies ReadingGroupsResponse));
  }
  try {
    const identity = await requireAccountIdentity(request);
    const groups = await accountReadingGroups(identity.memberId);
    return noStore(Response.json({ enabled: true, groups, selectedGroupId: selectedGroupId(request, groups) } satisfies ReadingGroupsResponse));
  } catch (error) {
    return readingGroupErrorResponse(error);
  }
}

export async function POST(request: Request) {
  if (!readingGroupsEnabled()) return noStore(Response.json({ error: "Sayfa bulunamadı." }, { status: 404 }));
  try {
    const body = await request.json().catch(() => null) as { groupId?: unknown } | null;
    if (!validGroupId(body?.groupId)) {
      return noStore(Response.json({ error: "Geçersiz okuma grubu." }, { status: 400 }));
    }
    const group = await selectReadingGroup(request, body.groupId);
    const response = noStore(NextResponse.json({ ok: true, group }));
    response.cookies.set(READING_GROUP_COOKIE, group.id, groupCookieOptions(request));
    return response;
  } catch (error) {
    return readingGroupErrorResponse(error);
  }
}
