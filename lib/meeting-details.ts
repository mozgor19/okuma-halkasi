export type MeetingKind = "in_person" | "online";
export type MeetingVenue = { kind: MeetingKind; location: string; mapUrl: string | null; onlineUrl: string | null };

function secureLink(value: unknown, label: string) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048 || /[\u0000-\u0020\u007f]/.test(value)) throw Error(`${label} geçerli bir HTTPS adresi olmalı.`);
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".")) throw Error();
    return url.href;
  } catch { throw Error(`${label} geçerli bir HTTPS adresi olmalı.`); }
}

export function meetingVenue(input: { kind?: unknown; location?: unknown; mapUrl?: unknown; onlineUrl?: unknown }, previous?: MeetingVenue): MeetingVenue {
  const kind = input.kind ?? previous?.kind ?? "in_person";
  if (kind !== "in_person" && kind !== "online") throw Error("Buluşma biçimini seç.");
  if (kind === "online") return { kind, location: "Çevrim içi", mapUrl: null,
    onlineUrl: secureLink(input.onlineUrl === undefined ? previous?.onlineUrl : input.onlineUrl, "Toplantı bağlantısı") };
  const location = typeof input.location === "string" ? input.location.trim() : previous?.location ?? "";
  if (!location || location.length > 180 || /[\u0000-\u001f\u007f]/.test(location)) throw Error("Buluşma yeri gerekli; en fazla 180 karakter olabilir.");
  return { kind, location, onlineUrl: null, mapUrl: secureLink(input.mapUrl === undefined ? previous?.mapUrl : input.mapUrl, "Harita bağlantısı") };
}

export function venueChanged(before: MeetingVenue & { date: string }, after: MeetingVenue & { date: string }) {
  return before.date !== after.date || before.kind !== after.kind || before.location !== after.location
    || before.mapUrl !== after.mapUrl || before.onlineUrl !== after.onlineUrl;
}

export function meetingLocation(meeting: { kind?: MeetingKind; location: string }) {
  return meeting.kind === "online" ? "Çevrim içi" : meeting.location;
}
