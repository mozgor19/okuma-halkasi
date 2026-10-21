import { database, getAuthenticatedMember } from "@/db/store";
import { readingGroupContext } from "@/db/database";
import { noStore, validGroupId, withReadingGroup } from "@/lib/groups";
import { meetingCalendar } from "@/lib/meeting-calendar";
import { meetingDetail, meetingDetailsReady } from "@/db/meeting-details";

export const runtime = "edge";

const protectedGET = withReadingGroup(handleGET);
export async function GET(request: Request, context: { params: Promise<{ meetingId: string }> }) {
  const response = await protectedGET(request, context);
  if ([401, 403, 409].includes(response.status) && (request.headers.get("Sec-Fetch-Mode") === "navigate" || request.headers.get("Accept")?.includes("text/html"))) {
    const { meetingId } = await context.params;
    if (/^[1-9]\d*$/.test(meetingId)) {
      // Mail readers may open a different browser/session. The normal app entry
      // handles login and authorized group selection before offering export.
      const params = new URLSearchParams({ meeting: meetingId });
      const group = new URL(request.url).searchParams.get("group");
      if (validGroupId(group)) params.set("group", group);
      return noStore(new Response(null, { status: 303, headers: { Location: "/?" + params.toString() } }));
    }
  }
  return response;
}

async function handleGET(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const actor = await getAuthenticatedMember(request);
  if (!actor) return new Response("Oturum gerekli.", { status: 401 });

  const { meetingId: value } = await context.params;
  const meetingId = Number(value);
  if (!Number.isInteger(meetingId)) return new Response("Buluşma bulunamadı.", { status: 404 });

  const meeting = await database()
    .read("SELECT m.id, m.date, m.location, m.note, m.reading_scope AS readingScope, b.title, b.author FROM meetings m JOIN books b ON b.id = m.book_id WHERE m.id = ? AND m.deleted_at IS NULL")
    .bind(meetingId)
    .first<{
      id: number;
      date: string;
      location: string;
      note: string | null;
      readingScope: string | null;
      title: string;
      author: string;
    }>();
  if (!meeting) return new Response("Buluşma bulunamadı.", { status: 404 });

  const origin = new URL(request.url).origin;
  const group = readingGroupContext()?.group;
  const detail = await meetingDetailsReady() ? await meetingDetail(meeting.id) : null;
  return new Response(meetingCalendar({ meeting: { ...meeting, ...detail }, title: meeting.title, author: meeting.author, origin, group }), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="bulusma-${meeting.id}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
