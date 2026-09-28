import { env } from "cloudflare:workers";
import type { AppData, Member } from "@/lib/types";

export function database() {
  if (!env.DB) throw new Error("Veritabanı bağlı değil.");
  return env.DB;
}
export async function getMember(id: unknown): Promise<Member | null> {
  if (!Number.isInteger(id) || Number(id) < 1) return null;
  return await database().prepare("SELECT id, name, role, color FROM members WHERE id = ?").bind(id).first<Member>();
}
export async function getState(): Promise<AppData> {
  const queries = [
    "SELECT id, name, role, color FROM members ORDER BY id",
    "SELECT id, title, author, publisher, pages, isbn, cover_url AS coverUrl, source_url AS sourceUrl FROM books ORDER BY id",
    "SELECT id, book_id AS bookId, date, location, map_url AS mapUrl, note, created_by AS createdBy FROM meetings ORDER BY date DESC",
    "SELECT meeting_id AS meetingId, member_id AS memberId, reading_status AS readingStatus FROM attendance",
    "SELECT meeting_id AS meetingId, member_id AS memberId, rating, comment, updated_at AS updatedAt FROM reviews",
    "SELECT id, meeting_id AS meetingId, media_key AS mediaKey, uploaded_by AS uploadedBy, created_at AS createdAt FROM photos ORDER BY id DESC",
    "SELECT id, book_id AS bookId, planned_date AS plannedDate, note, created_by AS createdBy FROM roadmap ORDER BY planned_date IS NULL, planned_date, id",
  ];
  const results = await Promise.all(queries.map(async (query) => (await database().prepare(query).all()).results));
  const [members, books, meetings, attendance, reviews, photos, roadmap] = results;
  return { members, books, meetings, attendance, reviews, photos, roadmap } as unknown as AppData;
}
