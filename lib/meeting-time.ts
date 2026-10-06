import type { Meeting } from "@/lib/types";

export type FeaturedKind = "week" | "upcoming" | "past";

export function weekBounds(now: Date) {
  const start = new Date(now);
  const day = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

export function chooseFeatured(meetings: Meeting[], now: Date) {
  const ascending = [...meetings].sort((left, right) => left.date.localeCompare(right.date));
  const { start, end } = weekBounds(now);
  const thisWeek = ascending.filter((meeting) => {
    const date = new Date(meeting.date);
    return date >= start && date < end;
  });

  if (thisWeek.length) {
    const nextThisWeek = thisWeek.find((meeting) => new Date(meeting.date) >= now);
    return {
      meeting: nextThisWeek ?? thisWeek[thisWeek.length - 1],
      kind: "week" as const,
    };
  }

  const upcoming = ascending.find((meeting) => new Date(meeting.date) >= now);
  if (upcoming) return { meeting: upcoming, kind: "upcoming" as const };

  return {
    meeting: ascending[ascending.length - 1],
    kind: "past" as const,
  };
}

export function meetingRsvpIsOpen(meeting: Pick<Meeting, "date">, now: Date) {
  const meetingDay = meeting.date.slice(0, 10);
  const closesAt = new Date(meetingDay + "T23:59:59+03:00");
  return now <= closesAt;
}

export function meetingTimingLabel(meeting: Meeting, now: Date) {
  const { start, end } = weekBounds(now);
  const date = new Date(meeting.date);
  if (date >= start && date < end) return "BU HAFTA";
  if (date >= now) return "YAKLAŞAN";
  return "GEÇMİŞ";
}
