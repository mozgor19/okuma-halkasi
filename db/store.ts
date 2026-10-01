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

export async function getMember(id: unknown): Promise<Member | null> {
  if (!Number.isInteger(id) || Number(id) < 1) return null;
  const member = await database()
    .prepare("SELECT id, name, role, color FROM members WHERE id = ?")
    .bind(id)
    .first<Omit<Member, "avatarMediaKey" | "faceReferenceMediaKey" | "faceRecognitionConsent">>();
  return member
    ? {
        ...member,
        avatarMediaKey: null,
        faceReferenceMediaKey: null,
        faceRecognitionConsent: false,
      }
    : null;
}

export async function getAuthenticatedMember(request: Request): Promise<Member | null> {
  const identity = await sessionIdentity(sessionTokenFromRequest(request));
  if (!identity || !(await sessionAccountIsCurrent(identity))) return null;
  return getMember(identity.memberId);
}

async function runStateQueries(extended: boolean, faceRecognition: boolean) {
  const queries = [
    extended
      ? faceRecognition
        ? "SELECT id, name, role, color, avatar_media_key AS avatarMediaKey, face_reference_media_key AS faceReferenceMediaKey, face_recognition_consent AS faceRecognitionConsent FROM members ORDER BY id"
        : "SELECT id, name, role, color, avatar_media_key AS avatarMediaKey, NULL AS faceReferenceMediaKey, 0 AS faceRecognitionConsent FROM members ORDER BY id"
      : "SELECT id, name, role, color, NULL AS avatarMediaKey, NULL AS faceReferenceMediaKey, 0 AS faceRecognitionConsent FROM members ORDER BY id",
    "SELECT id, title, author, publisher, pages, isbn, cover_url AS coverUrl, source_url AS sourceUrl FROM books ORDER BY id",
    extended
      ? "SELECT id, book_id AS bookId, date, location, map_url AS mapUrl, note, reading_scope AS readingScope, book_status AS bookStatus, created_by AS createdBy FROM meetings ORDER BY date DESC"
      : "SELECT id, book_id AS bookId, date, location, map_url AS mapUrl, note, NULL AS readingScope, 'completed' AS bookStatus, created_by AS createdBy FROM meetings ORDER BY date DESC",
    "SELECT meeting_id AS meetingId, member_id AS memberId, reading_status AS readingStatus FROM attendance",
    "SELECT meeting_id AS meetingId, member_id AS memberId, rating, comment, updated_at AS updatedAt FROM reviews",
    "SELECT id, meeting_id AS meetingId, media_key AS mediaKey, uploaded_by AS uploadedBy, created_at AS createdAt FROM photos ORDER BY id DESC",
    "SELECT id, book_id AS bookId, planned_date AS plannedDate, note, created_by AS createdBy FROM roadmap ORDER BY planned_date IS NULL, planned_date, id",
  ];
  if (extended) {
    queries.push(
      "SELECT member_id AS memberId, book_id AS bookId, created_at AS createdAt FROM favorite_books ORDER BY created_at DESC",
    );
  }

  const results = await Promise.all(
    queries.map(async (query) => (await database().prepare(query).all()).results),
  );
  const [memberRows, books, meetings, attendance, reviews, photos, roadmap] = results;
  const members = (memberRows as Array<Record<string, unknown>>).map((member) => ({
    ...member,
    faceRecognitionConsent: Boolean(member.faceRecognitionConsent),
  }));
  return {
    members,
    books,
    meetings,
    attendance,
    reviews,
    photos,
    roadmap,
    favorites: extended ? results[7] : [],
  } as unknown as AppData;
}

export async function getState(): Promise<AppData> {
  try {
    return await runStateQueries(true, true);
  } catch (error) {
    if (faceSchemaMissing(error)) {
      try {
        return await runStateQueries(true, false);
      } catch (fallbackError) {
        if (profileSchemaMissing(fallbackError)) return runStateQueries(false, false);
        throw fallbackError;
      }
    }
    if (profileSchemaMissing(error)) return runStateQueries(false, false);
    throw error;
  }
}
