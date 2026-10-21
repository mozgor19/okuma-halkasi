import { database, getAuthenticatedMember } from "@/db/store";
import { readingGroupContext } from "@/db/database";
import { withReadingGroup } from "@/lib/groups";
import { meetingCalendar } from "@/lib/meeting-calendar";
import { meetingDetail, meetingDetailsReady } from "@/db/meeting-details";

export const runtime = "edge";

export const GET = withReadingGroup(handleGET);

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
