import { getAuthenticatedMember } from "@/db/store";
import { meetingMailPreference, saveMeetingMailPreference, deferMeetingChanges, meetingMailQueue } from "@/db/meeting-mail";
import { readingGroupContext } from "@/db/database";
import { noStore, withReadingGroup, ReadingGroupError, readingGroupErrorResponse } from "@/lib/groups";
import { jsonBody, sameOrigin, rateLimit } from "@/lib/onboarding-security";
import { isAdminRole } from "@/lib/types";

export const runtime = "edge";
export const GET = withReadingGroup(async (request: Request) => {
  const actor = await getAuthenticatedMember(request);
  if (!actor) return noStore(Response.json({ error: "Oturum gerekli." }, { status: 401 }));
  return noStore(Response.json({ ...await meetingMailPreference(), ...(isAdminRole(actor.role) ? { queue: await meetingMailQueue() } : {}) }));
});
export const POST = withReadingGroup(async (request: Request) => {
  try {
    sameOrigin(request);
    const actor = await getAuthenticatedMember(request);
    if (!actor) throw new ReadingGroupError("AUTH_REQUIRED", 401, "Oturum gerekli.");
    await rateLimit(request, "meeting-mail-preference", 30, 900, String(readingGroupContext()!.accountMemberId));
    const body = await jsonBody(request);
    if (body.action === "retry") {
      if (!isAdminRole(actor.role)) throw new ReadingGroupError("FORBIDDEN", 403, "Bu işlem için yönetici yetkisi gerekli.");
      deferMeetingChanges(); return noStore(Response.json({ queued: true }));
    }
    return noStore(Response.json(await saveMeetingMailPreference(body.enabled)));
  } catch (error) { return readingGroupErrorResponse(error); }
});
