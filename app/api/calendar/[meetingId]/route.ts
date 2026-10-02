import { database, getAuthenticatedMember } from "@/db/store";

export const runtime = "edge";

const escapeIcs = (value: string) =>
  value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");

const utcStamp = (date: Date) =>
  date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export async function GET(
  request: Request,
  context: { params: Promise<{ meetingId: string }> },
) {
  const actor = await getAuthenticatedMember(request);
  if (!actor) return new Response("Oturum gerekli.", { status: 401 });

  const { meetingId: value } = await context.params;
  const meetingId = Number(value);
  if (!Number.isInteger(meetingId)) return new Response("Buluşma bulunamadı.", { status: 404 });

  const meeting = await database()
    .prepare(
      "SELECT m.id, m.date, m.location, m.note, m.reading_scope AS readingScope, b.title, b.author FROM meetings m JOIN books b ON b.id = m.book_id WHERE m.id = ? AND m.deleted_at IS NULL",
    )
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

  const startsAt = new Date(`${meeting.date}:00+03:00`);
  const endsAt = new Date(startsAt.getTime() + 2 * 60 * 60 * 1000);
  const description = [meeting.author, meeting.readingScope, meeting.note].filter(Boolean).join("\n");
  const origin = new URL(request.url).origin;
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Kitap Tahlil ve Istisare//TR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:meeting-${meeting.id}@${new URL(request.url).hostname}`,
    `DTSTAMP:${utcStamp(new Date())}`,
    `DTSTART:${utcStamp(startsAt)}`,
    `DTEND:${utcStamp(endsAt)}`,
    `SUMMARY:${escapeIcs(`Kitap Tahlili: ${meeting.title}`)}`,
    `LOCATION:${escapeIcs(meeting.location)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    `URL:${origin}/`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ];

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="bulusma-${meeting.id}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
