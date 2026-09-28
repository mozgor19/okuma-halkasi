import { database, getAuthenticatedMember, getMember } from "@/db/store";
export const runtime = "edge";

type BookInput = { title?: unknown; author?: unknown; publisher?: unknown; pages?: unknown; isbn?: unknown; coverUrl?: unknown; sourceUrl?: unknown };
type Payload = { action?: string; meetingId?: number; targetId?: number; planId?: number; book?: BookInput; date?: string | null; location?: string; mapUrl?: string; note?: string; readingStatus?: string; rating?: number; comment?: string };
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const fail = (message: string, status = 400) => Response.json({ error: message }, { status });
function safeCover(value: unknown) {
  const url = clean(value, 500);
  if (/^\/api\/media\/[a-f0-9-]{36}$/.test(url) || /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-[SML]\.jpg$/.test(url)) return url;
  return null;
}
function safeSource(value: unknown) {
  const url = clean(value, 500);
  return /^https:\/\/openlibrary\.org\/(works|books)\//.test(url) ? url : null;
}
async function addBook(input: BookInput) {
  const title = clean(input.title, 180); const author = clean(input.author, 140);
  if (!title || !author) throw new Error("Kitap adı ve yazar gerekli.");
  const pages = Number(input.pages);
  const result = await database().prepare("INSERT INTO books (title, author, publisher, pages, isbn, cover_url, source_url) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(title, author, clean(input.publisher, 140) || null, Number.isInteger(pages) && pages > 0 && pages <= 10000 ? pages : null, clean(input.isbn, 20) || null, safeCover(input.coverUrl), safeSource(input.sourceUrl)).run();
  return result.meta.last_row_id;
}

export async function POST(request: Request) {
  const actor = await getAuthenticatedMember(request);
  if (!actor) return fail("Oturum gerekli.", 401);
  let input: Payload;
  try { input = await request.json() as Payload; } catch { return fail("Geçersiz istek."); }
  try {
    if (input.action === "createMeeting" || input.action === "createPlan") {
      if (input.action === "createPlan" && actor.role !== "admin") return fail("Gelecek kitapları yönetici ekleyebilir.", 403);
      if (!input.book || typeof input.book !== "object") return fail("Kitap bilgileri eksik.");
      if (input.action === "createMeeting" && (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.date ?? "") || !clean(input.location, 180))) return fail("Buluşma tarihi ve yeri gerekli.");
      const mapUrl = clean(input.mapUrl, 500);
      if (input.action === "createMeeting" && mapUrl && !/^https:\/\//.test(mapUrl)) return fail("Harita bağlantısı https:// ile başlamalı.");
      if (input.action === "createPlan" && input.date && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)) return fail("Tarih biçimi geçersiz.");
      let bookId: number;
      if (input.action === "createMeeting" && Number.isInteger(input.planId)) {
        if (actor.role !== "admin") return fail("Planı yönetici buluşmaya taşıyabilir.", 403);
        const plan = await database().prepare("SELECT book_id AS bookId FROM roadmap WHERE id = ?").bind(input.planId).first<{ bookId: number }>();
        if (!plan) return fail("Planlanan kitap bulunamadı.", 404);
        bookId = plan.bookId;
      } else bookId = await addBook(input.book);
      if (input.action === "createPlan") {
        await database().prepare("INSERT INTO roadmap (book_id, planned_date, note, created_by) VALUES (?, ?, ?, ?)").bind(bookId, input.date || null, clean(input.note, 1000) || null, actor.id).run();
        return Response.json({ ok: true });
      }
      const insert = database().prepare("INSERT INTO meetings (book_id, date, location, map_url, note, created_by) VALUES (?, ?, ?, ?, ?, ?)")
        .bind(bookId, input.date, clean(input.location, 180), mapUrl || null, clean(input.note, 1000) || null, actor.id);
      const result = Number.isInteger(input.planId)
        ? (await database().batch([insert, database().prepare("DELETE FROM roadmap WHERE id = ?").bind(input.planId)]))[0]
        : await insert.run();
      return Response.json({ ok: true, meetingId: result.meta.last_row_id });
    }
    if (input.action === "review") {
      const meetingId = Number(input.meetingId), rating = Number(input.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 10) return fail("Puan 1–10 arasında zorunludur.");
      if (!["read", "partial", "unread"].includes(input.readingStatus ?? "")) return fail("Okuma durumunu seç.");
      if (!Number.isInteger(meetingId) || !(await database().prepare("SELECT id FROM meetings WHERE id = ?").bind(meetingId).first())) return fail("Buluşma bulunamadı.", 404);
      await database().batch([
        database().prepare("INSERT INTO attendance (meeting_id, member_id, reading_status) VALUES (?, ?, ?) ON CONFLICT(meeting_id, member_id) DO UPDATE SET reading_status = excluded.reading_status").bind(meetingId, actor.id, input.readingStatus),
        database().prepare("INSERT INTO reviews (meeting_id, member_id, rating, comment) VALUES (?, ?, ?, ?) ON CONFLICT(meeting_id, member_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, updated_at = CURRENT_TIMESTAMP").bind(meetingId, actor.id, rating, clean(input.comment, 1000) || null),
      ]);
      return Response.json({ ok: true });
    }
    if (input.action === "addAttendance") {
      if (actor.role !== "admin") return fail("Başka birini yönetici ekleyebilir.", 403);
      const target = await getMember(input.targetId);
      if (!target || !Number.isInteger(input.meetingId)) return fail("Katılımcı veya buluşma bulunamadı.");
      const meeting = await database().prepare("SELECT id FROM meetings WHERE id = ?").bind(input.meetingId).first();
      if (!meeting) return fail("Buluşma bulunamadı.", 404);
      await database().prepare("INSERT OR IGNORE INTO attendance (meeting_id, member_id, reading_status) VALUES (?, ?, 'unselected')").bind(input.meetingId, target.id).run();
      return Response.json({ ok: true });
    }
    if (input.action === "deletePlan") {
      if (actor.role !== "admin") return fail("Planları yönetici değiştirebilir.", 403);
      if (!Number.isInteger(input.planId)) return fail("Plan bulunamadı.");
      await database().prepare("DELETE FROM roadmap WHERE id = ?").bind(input.planId).run();
      return Response.json({ ok: true });
    }
    if (input.action === "editMeeting") {
      if (actor.role !== "admin") return fail("Buluşmayı yönetici düzenleyebilir.", 403);
      if (!Number.isInteger(input.meetingId) || !clean(input.location, 180)) return fail("Buluşma yeri gerekli.");
      const mapUrl = clean(input.mapUrl, 500);
      if (mapUrl && !/^https:\/\//.test(mapUrl)) return fail("Harita bağlantısı https:// ile başlamalı.");
      await database().prepare("UPDATE meetings SET location = ?, map_url = ?, note = ? WHERE id = ?")
        .bind(clean(input.location, 180), mapUrl || null, clean(input.note, 1000) || null, input.meetingId).run();
      return Response.json({ ok: true });
    }
    return fail("Bilinmeyen işlem.");
  } catch (error) {
    console.error("Reading circle action failed", error);
    return fail(error instanceof Error && error.message === "Kitap adı ve yazar gerekli." ? error.message : "İşlem kaydedilemedi. Yeniden dene.", 503);
  }
}
