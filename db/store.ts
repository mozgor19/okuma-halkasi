import { sessionAccountIsCurrent } from "@/db/accounts";
import { database } from "@/db/database";
import { sessionIdentity, sessionTokenFromRequest } from "@/lib/auth";
import type { AppData, Member } from "@/lib/types";

export { database } from "@/db/database";

export function profileSchemaMissing(error: unknown): boolean {
  return /(?:no such table:\s*favorite_books|(?:no such column:|has no column named).*?(?:avatar_media_key|reading_scope|book_status))/i
    .test(error instanceof Error ? error.message : String(error));
}

export function faceSchemaMissing(error: unknown): boolean {
  return /(?:no such column:|has no column named).*?(?:face_reference_media_key|face_recognition_consent)/i
    .test(error instanceof Error ? error.message : String(error));
}

export function clubSchemaMissing(error: unknown): boolean {
  return /(?:no such table:\s*(?:book_votes|club_settings)|(?:no such column:|has no column named).*?(?:current_page|is_guest|guest_meeting_id|deleted_at))/i
    .test(error instanceof Error ? error.message : String(error));
}

export function rsvpSchemaMissing(error: unknown): boolean {
  return String(error instanceof Error ? error.message : error).toLowerCase().includes("no such table: meeting_rsvps");
}

export async function getMember(id: unknown): Promise<Member | null> {
  if (!Number.isInteger(id) || Number(id) < 1) return null;
  const member = await database()
    .prepare("SELECT id, name, role, color FROM members WHERE id = ?")
    .bind(id)
    .first<Omit<Member, "avatarMediaKey" | "faceReferenceMediaKey" | "faceRecognitionConsent" | "isGuest" | "guestMeetingId">>();
  return member
    ? {
        ...member,
        avatarMediaKey: null,
        faceReferenceMediaKey: null,
        faceRecognitionConsent: false,
        isGuest: false,
        guestMeetingId: null,
      }
    : null;
}

export async function getAuthenticatedMember(request: Request): Promise<Member | null> {
  const identity = await sessionIdentity(sessionTokenFromRequest(request));
  if (!identity || !(await sessionAccountIsCurrent(identity))) return null;
  return getMember(identity.memberId);
}

async function runStateQueries(extended: boolean, faceRecognition: boolean, clubFeatures: boolean, rsvpFeatures: boolean) {
  const memberColumns = extended
    ? faceRecognition
      ? "avatar_media_key AS avatarMediaKey, face_reference_media_key AS faceReferenceMediaKey, face_recognition_consent AS faceRecognitionConsent"
      : "avatar_media_key AS avatarMediaKey, NULL AS faceReferenceMediaKey, 0 AS faceRecognitionConsent"
    : "NULL AS avatarMediaKey, NULL AS faceReferenceMediaKey, 0 AS faceRecognitionConsent";
  const guestColumns = clubFeatures
    ? "is_guest AS isGuest, guest_meeting_id AS guestMeetingId"
    : "0 AS isGuest, NULL AS guestMeetingId";

  const queries = [
    `SELECT id, name, role, color, ${memberColumns}, ${guestColumns} FROM members ORDER BY id`,
    "SELECT id, title, author, publisher, pages, isbn, cover_url AS coverUrl, source_url AS sourceUrl FROM books ORDER BY id",
    extended
      ? clubFeatures
        ? "SELECT id, book_id AS bookId, date, location, map_url AS mapUrl, note, reading_scope AS readingScope, book_status AS bookStatus, created_by AS createdBy, created_at AS createdAt, deleted_at AS deletedAt FROM meetings WHERE deleted_at IS NULL ORDER BY date DESC"
        : "SELECT id, book_id AS bookId, date, location, map_url AS mapUrl, note, reading_scope AS readingScope, book_status AS bookStatus, created_by AS createdBy, created_at AS createdAt, NULL AS deletedAt FROM meetings ORDER BY date DESC"
      : "SELECT id, book_id AS bookId, date, location, map_url AS mapUrl, note, NULL AS readingScope, 'completed' AS bookStatus, created_by AS createdBy, created_at AS createdAt, NULL AS deletedAt FROM meetings ORDER BY date DESC",
    clubFeatures
      ? "SELECT a.meeting_id AS meetingId, a.member_id AS memberId, a.reading_status AS readingStatus, a.current_page AS currentPage FROM attendance a JOIN meetings m ON m.id = a.meeting_id WHERE m.deleted_at IS NULL"
      : "SELECT meeting_id AS meetingId, member_id AS memberId, reading_status AS readingStatus, NULL AS currentPage FROM attendance",
    clubFeatures
      ? "SELECT r.meeting_id AS meetingId, r.member_id AS memberId, r.rating, r.comment, r.updated_at AS updatedAt FROM reviews r JOIN meetings m ON m.id = r.meeting_id WHERE m.deleted_at IS NULL"
      : "SELECT meeting_id AS meetingId, member_id AS memberId, rating, comment, updated_at AS updatedAt FROM reviews",
    clubFeatures
      ? "SELECT p.id, p.meeting_id AS meetingId, p.media_key AS mediaKey, p.uploaded_by AS uploadedBy, p.created_at AS createdAt FROM photos p JOIN meetings m ON m.id = p.meeting_id WHERE m.deleted_at IS NULL ORDER BY p.id DESC"
      : "SELECT id, meeting_id AS meetingId, media_key AS mediaKey, uploaded_by AS uploadedBy, created_at AS createdAt FROM photos ORDER BY id DESC",
    clubFeatures
      ? "SELECT id, book_id AS bookId, planned_date AS plannedDate, note, created_by AS createdBy, deleted_at AS deletedAt FROM roadmap WHERE deleted_at IS NULL ORDER BY planned_date IS NULL, planned_date, id"
      : "SELECT id, book_id AS bookId, planned_date AS plannedDate, note, created_by AS createdBy, NULL AS deletedAt FROM roadmap ORDER BY planned_date IS NULL, planned_date, id",
  ];

  if (extended) {
    queries.push(
      "SELECT member_id AS memberId, book_id AS bookId, created_at AS createdAt FROM favorite_books ORDER BY created_at DESC",
    );
  }
  if (clubFeatures) {
    queries.push(
      "SELECT member_id AS memberId, roadmap_id AS roadmapId, created_at AS createdAt FROM book_votes ORDER BY created_at",
      "SELECT value FROM club_settings WHERE key = 'book_vote_visibility'",
      "SELECT 'meeting' AS type, id, book_id AS bookId, deleted_at AS deletedAt, date FROM meetings WHERE deleted_at IS NOT NULL UNION ALL SELECT 'plan' AS type, id, book_id AS bookId, deleted_at AS deletedAt, planned_date AS date FROM roadmap WHERE deleted_at IS NOT NULL ORDER BY deletedAt DESC",
    );
  }

  let rsvpIndex = -1;
  if (rsvpFeatures) {
    rsvpIndex = queries.length;
    queries.push(
      "SELECT meeting_id AS meetingId, member_id AS memberId, created_at AS createdAt, updated_at AS updatedAt FROM meeting_rsvps ORDER BY created_at",
    );
  }

  const results = await Promise.all(
    queries.map(async (query) => (await database().prepare(query).all()).results),
  );
  const [memberRows, books, meetings, attendance, reviews, photos, roadmap] = results;
  const members = (memberRows as Array<Record<string, unknown>>).map((member) => ({
    ...member,
    faceRecognitionConsent: Boolean(member.faceRecognitionConsent),
    isGuest: Boolean(member.isGuest),
  }));
  const votesIndex = extended ? 8 : 7;
  const visibility = clubFeatures
    ? (results[votesIndex + 1]?.[0] as { value?: string } | undefined)?.value
    : undefined;

  return {
    members,
    books,
    meetings,
    attendance,
    meetingRsvps: rsvpFeatures ? results[rsvpIndex] : [],
    reviews,
    photos,
    roadmap,
    favorites: extended ? results[7] : [],
    bookVotes: clubFeatures ? results[votesIndex] : [],
    voteVisibility: visibility === "secret" ? "secret" : "open",
    trash: clubFeatures ? results[votesIndex + 2] : [],
    clubFeaturesReady: clubFeatures,
    rsvpFeaturesReady: rsvpFeatures,
  } as unknown as AppData;
}

export async function getState(): Promise<AppData> {
  const attempts: Array<[boolean, boolean, boolean, boolean]> = [
    [true, true, true, true],
    [true, true, true, false],
    [true, false, true, true],
    [true, false, true, false],
    [true, true, false, true],
    [true, true, false, false],
    [true, false, false, true],
    [true, false, false, false],
    [false, false, false, false],
  ];
  let lastError: unknown;

  for (const [extended, faceRecognition, clubFeatures, rsvpFeatures] of attempts) {
    try {
      return await runStateQueries(extended, faceRecognition, clubFeatures, rsvpFeatures);
    } catch (error) {
      lastError = error;
      if (!profileSchemaMissing(error) && !faceSchemaMissing(error) && !clubSchemaMissing(error) && !rsvpSchemaMissing(error)) throw error;
    }
  }

  throw lastError;
}
