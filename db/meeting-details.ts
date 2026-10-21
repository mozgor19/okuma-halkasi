import { domainDatabase as database, readingGroupContext } from "@/db/database";
import { ReadingGroupError } from "@/lib/groups";
import { meetingVenue, venueChanged, type MeetingKind, type MeetingVenue } from "@/lib/meeting-details";
import type { AppData, Meeting } from "@/lib/types";

export type MeetingDetail = { meetingId: number; kind: MeetingKind; onlineUrl: string | null; revision: number; updatedAt: number };
export type MeetingChange = { id: string; meetingId: number; revision: number; createdAt: number; payload: string };
export async function meetingDetailsReady() {
  const prefix = readingGroupContext()?.sharedGroupId ? "shared_" : "";
  const result = await database().read("SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name IN (?, ?)")
    .bind(prefix + "meeting_details", prefix + "meeting_change_events").first<{ n: number }>();
  return result?.n === 2;
}
export async function meetingDetail(meetingId: number) {
  return database().read("SELECT meeting_id AS meetingId,kind,online_url AS onlineUrl,revision,updated_at AS updatedAt FROM meeting_details WHERE meeting_id=?", ["meeting_details"])
    .bind(meetingId).first<MeetingDetail>();
}
export async function enrichMeetingState(state: AppData): Promise<AppData> {
  if (!await meetingDetailsReady()) return { ...state, meetingDetailsReady: false, meetingChanges: [] };
  const details = await database().read("SELECT meeting_id AS meetingId,kind,online_url AS onlineUrl,revision,updated_at AS updatedAt FROM meeting_details", ["meeting_details"]).all<MeetingDetail>();
  const changes = await database().read(`SELECT e.id,e.meeting_id AS meetingId,e.revision,e.created_at AS createdAt
    FROM meeting_change_events e JOIN meetings m ON m.id=e.meeting_id WHERE m.deleted_at IS NULL AND e.created_at>? ORDER BY e.created_at DESC LIMIT 100`, ["meeting_change_events"])
    .bind(Date.now() - 30 * 86400_000).all<Omit<MeetingChange, "payload">>();
  return { ...state, meetingDetailsReady: true, meetingChanges: changes.results,
    meetings: state.meetings.map((meeting) => {
      const detail = details.results.find((item) => item.meetingId === meeting.id);
      return { ...meeting, kind: detail?.kind ?? "in_person", onlineUrl: detail?.onlineUrl ?? null,
        revision: detail?.revision ?? 0, ...(detail ? { updatedAt: detail.updatedAt } : {}) };
    }) };
}
export async function updateMeetingDetails(input: { meetingId: number; date: string; location?: unknown; mapUrl?: unknown; kind?: unknown; onlineUrl?: unknown; note: string | null; readingScope: string | null; bookStatus: string; revision?: number }) {
  const db = database();
  const old = await db.read("SELECT id,date,location,map_url AS mapUrl,note,reading_scope AS readingScope,book_status AS bookStatus FROM meetings WHERE id=? AND deleted_at IS NULL")
    .bind(input.meetingId).first<Meeting>();
  if (!old) throw new ReadingGroupError("MEETING_NOT_FOUND", 404, "Buluşma bulunamadı.");
  const detail = await meetingDetail(old.id);
  const before = { ...old, kind: detail?.kind ?? "in_person", onlineUrl: detail?.onlineUrl ?? null };
  let venue: MeetingVenue;
  try { venue = meetingVenue(input, before); } catch (error) { throw new ReadingGroupError("INVALID_VENUE", 400, (error as Error).message); }
  const expected = detail?.revision ?? 0;
  if (input.revision !== undefined && input.revision !== expected) throw new ReadingGroupError("MEETING_CHANGED", 409, "Buluşma başka bir yerde değiştirildi. Güncel kaydı açıp yeniden dene.");
  const next = { ...venue, date: input.date };
  const changed = venueChanged(before, next);
  if (!changed && old.note === input.note && old.readingScope === input.readingScope && old.bookStatus === input.bookStatus) return null;
  const now = Date.now(), eventId = crypto.randomUUID();
  const commands = [
    db.insertSelect("meeting_details", "meeting_id,kind,online_url,revision,updated_at", "id,?,?,?,?", "FROM meetings WHERE id=? AND deleted_at IS NULL", {
      conflict: "meeting_id", update: "kind=excluded.kind,online_url=excluded.online_url,revision=excluded.revision,updated_at=excluded.updated_at WHERE revision=?",
    }).bind(venue.kind, venue.onlineUrl, expected + 1, now, old.id, expected),
    db.update("meetings", "date=?,location=?,map_url=?,note=?,reading_scope=?,book_status=?", "id=? AND deleted_at IS NULL AND changes()=1")
      .bind(input.date, venue.location, venue.mapUrl, input.note, input.readingScope, input.bookStatus, old.id),
  ];
  if (changed) commands.push(db.insertSelect("meeting_change_events", "id,meeting_id,revision,payload,created_at", "?,?,?,?,?", "WHERE changes()=1")
    .bind(eventId, old.id, expected + 1, JSON.stringify({ before: { date: old.date, kind: before.kind, location: before.location, mapUrl: before.mapUrl, onlineUrl: before.onlineUrl }, after: next }), now));
  const results = await db.batch(commands);
  if (!results[1].meta.changes) throw new ReadingGroupError("MEETING_CHANGED", 409, "Buluşma değişti. Güncel kaydı açıp yeniden dene.");
  return changed ? eventId : null;
}
