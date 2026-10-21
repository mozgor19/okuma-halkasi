import type { Meeting } from "@/lib/types";

const escapeIcs = (value: string) => value.replace(/\r/g, "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
function fold(line: string) {
  const lines: string[] = []; let current = "", bytes = 0;
  for (const character of line) {
    const size = new TextEncoder().encode(character).length;
    if (bytes + size > 75) { lines.push(current); current = " "; bytes = 1; }
    current += character; bytes += size;
  }
  lines.push(current); return lines.join("\r\n");
}

export function meetingCalendar({ meeting, title, author, origin, group, generatedAt = new Date() }: {
  meeting: Pick<Meeting, "id" | "date" | "location" | "note" | "readingScope" | "kind" | "onlineUrl" | "revision" | "updatedAt">;
  title: string; author: string; origin: string; group?: { id: string; name: string }; generatedAt?: Date;
}) {
  const startsAt = new Date(`${meeting.date}:00+03:00`);
  const url = new URL("/", origin); url.searchParams.set("meeting", String(meeting.id)); if (group) url.searchParams.set("group", group.id);
  const description = [author, meeting.readingScope, meeting.note, meeting.kind === "online" ? meeting.onlineUrl : null].filter(Boolean).join("\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Koru//TR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    ...(group ? [`X-WR-CALNAME:${escapeIcs(group.name)}`] : []), "BEGIN:VEVENT",
    `UID:meeting-${group ? `${group.id}-` : ""}${meeting.id}@${new URL(origin).hostname}`,
    `DTSTAMP:${stamp(generatedAt)}`, `SEQUENCE:${meeting.revision ?? 0}`,
    ...(meeting.updatedAt ? [`LAST-MODIFIED:${stamp(new Date(meeting.updatedAt))}`] : []),
    `DTSTART:${stamp(startsAt)}`, `DTEND:${stamp(new Date(startsAt.getTime() + 2 * 3600_000))}`,
    `SUMMARY:${escapeIcs(`Kitap Tahlili: ${title}`)}`,
    `LOCATION:${escapeIcs(meeting.kind === "online" ? meeting.onlineUrl || "Çevrim içi" : meeting.location)}`,
    `DESCRIPTION:${escapeIcs(description)}`, `URL:${url.href}`, "END:VEVENT", "END:VCALENDAR", ""].map(fold).join("\r\n");
}
