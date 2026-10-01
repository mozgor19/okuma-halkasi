import { database, faceSchemaMissing, getAuthenticatedMember, getMember, profileSchemaMissing } from "@/db/store";

export const runtime = "edge";

type BookInput = {
  title?: unknown;
  author?: unknown;
  publisher?: unknown;
  pages?: unknown;
  isbn?: unknown;
  coverUrl?: unknown;
  sourceUrl?: unknown;
};

type Payload = {
  action?: string;
  meetingId?: number;
  targetId?: number;
  targetIds?: number[];
  planId?: number;
  bookId?: number;
  book?: BookInput;
  date?: string | null;
  location?: string;
  mapUrl?: string;
  note?: string;
  readingScope?: string;
  bookStatus?: string;
  readingStatus?: string;
  rating?: number;
  comment?: string;
  active?: boolean;
};

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const fail = (message: string, status = 400) =>
  Response.json({ error: message }, { status });

function safeCover(value: unknown) {
  const url = clean(value, 500);
  if (
    /^\/api\/media\/[a-f0-9-]{36}$/.test(url)
    || /^https:\/\/covers\.openlibrary\.org\/b\/id\/\d+-[SML]\.jpg$/.test(url)
  ) return url;
  return null;
}

function safeSource(value: unknown) {
  const url = clean(value, 500);
  return /^https:\/\/openlibrary\.org\/(works|books)\//.test(url) ? url : null;
}

function bookValues(input: BookInput) {
  const title = clean(input.title, 180);
  const author = clean(input.author, 140);
  if (!title || !author) throw new Error("Kitap adı ve yazar gerekli.");
  const pages = Number(input.pages);
  return {
    title,
    author,
    publisher: clean(input.publisher, 140) || null,
    pages: Number.isInteger(pages) && pages > 0 && pages <= 10000 ? pages : null,
    isbn: clean(input.isbn, 20) || null,
    coverUrl: safeCover(input.coverUrl),
    sourceUrl: safeSource(input.sourceUrl),
  };
}

async function addBook(input: BookInput) {
  const book = bookValues(input);
  const result = await database()
    .prepare(
      "INSERT INTO books (title, author, publisher, pages, isbn, cover_url, source_url) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(
      book.title,
      book.author,
      book.publisher,
      book.pages,
      book.isbn,
      book.coverUrl,
      book.sourceUrl,
    )
    .run();
  return Number(result.meta.last_row_id);
}

async function existingBook(bookId: unknown) {
  if (!Number.isInteger(bookId)) return null;
  return database()
    .prepare("SELECT id FROM books WHERE id = ?")
    .bind(bookId)
    .first<{ id: number }>();
}

function validMeetingDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);
}

function meetingBookStatus(value: unknown): "continuing" | "completed" {
  return value === "continuing" ? "continuing" : "completed";
}

export async function POST(request: Request) {
  const actor = await getAuthenticatedMember(request);
  if (!actor) return fail("Oturum gerekli.", 401);

  let input: Payload;
  try {
    input = await request.json() as Payload;
  } catch {
    return fail("Geçersiz istek.");
  }

  try {
    if (input.action === "createMeeting" || input.action === "createPlan") {
      if (input.action === "createPlan" && actor.role !== "admin") {
        return fail("Gelecek kitapları yönetici ekleyebilir.", 403);
      }
      if (
        input.action === "createMeeting"
        && (!validMeetingDate(input.date) || !clean(input.location, 180))
      ) {
        return fail("Buluşma tarihi ve yeri gerekli.");
      }

      const mapUrl = clean(input.mapUrl, 500);
      if (input.action === "createMeeting" && mapUrl && !/^https:\/\//.test(mapUrl)) {
        return fail("Harita bağlantısı https:// ile başlamalı.");
      }
      if (
        input.action === "createPlan"
        && input.date
        && !/^\d{4}-\d{2}-\d{2}$/.test(input.date)
      ) {
        return fail("Tarih biçimi geçersiz.");
      }

      let bookId: number;
      if (input.action === "createMeeting" && Number.isInteger(input.planId)) {
        if (actor.role !== "admin") {
          return fail("Planı yönetici buluşmaya taşıyabilir.", 403);
        }
        const plan = await database()
          .prepare("SELECT book_id AS bookId FROM roadmap WHERE id = ?")
          .bind(input.planId)
          .first<{ bookId: number }>();
        if (!plan) return fail("Planlanan kitap bulunamadı.", 404);
        bookId = plan.bookId;
      } else if (input.action === "createMeeting" && Number.isInteger(input.bookId)) {
        const book = await existingBook(input.bookId);
        if (!book) return fail("Kayıtlı kitap bulunamadı.", 404);
        bookId = book.id;
      } else {
        if (!input.book || typeof input.book !== "object") {
          return fail("Kitap bilgileri eksik.");
        }
        bookId = await addBook(input.book);
      }

      if (input.action === "createPlan") {
        await database()
          .prepare(
            "INSERT INTO roadmap (book_id, planned_date, note, created_by) VALUES (?, ?, ?, ?)",
          )
          .bind(
            bookId,
            input.date || null,
            clean(input.note, 1000) || null,
            actor.id,
          )
          .run();
        return Response.json({ ok: true });
      }

      const insert = database()
        .prepare(
          "INSERT INTO meetings (book_id, date, location, map_url, note, reading_scope, book_status, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          bookId,
          input.date,
          clean(input.location, 180),
          mapUrl || null,
          clean(input.note, 1000) || null,
          clean(input.readingScope, 180) || null,
          meetingBookStatus(input.bookStatus),
          actor.id,
        );
      const result = Number.isInteger(input.planId)
        ? (await database().batch([
            insert,
            database().prepare("DELETE FROM roadmap WHERE id = ?").bind(input.planId),
          ]))[0]
        : await insert.run();
      return Response.json({ ok: true, meetingId: result.meta.last_row_id });
    }

    if (input.action === "review") {
      const meetingId = Number(input.meetingId);
      const rating = Number(input.rating);
      if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
        return fail("Puan 1-10 arasında zorunludur.");
      }
      if (!["read", "partial", "unread"].includes(input.readingStatus ?? "")) {
        return fail("Okuma durumunu seç.");
      }
      if (
        !Number.isInteger(meetingId)
        || !(await database().prepare("SELECT id FROM meetings WHERE id = ?").bind(meetingId).first())
      ) {
        return fail("Buluşma bulunamadı.", 404);
      }
      await database().batch([
        database()
          .prepare(
            "INSERT INTO attendance (meeting_id, member_id, reading_status) VALUES (?, ?, ?) ON CONFLICT(meeting_id, member_id) DO UPDATE SET reading_status = excluded.reading_status",
          )
          .bind(meetingId, actor.id, input.readingStatus),
        database()
          .prepare(
            "INSERT INTO reviews (meeting_id, member_id, rating, comment) VALUES (?, ?, ?, ?) ON CONFLICT(meeting_id, member_id) DO UPDATE SET rating = excluded.rating, comment = excluded.comment, updated_at = CURRENT_TIMESTAMP",
          )
          .bind(meetingId, actor.id, rating, clean(input.comment, 1000) || null),
      ]);
      return Response.json({ ok: true });
    }

    if (input.action === "toggleFavorite") {
      const book = await existingBook(input.bookId);
      if (!book) return fail("Kitap bulunamadı.", 404);
      if (input.active) {
        await database()
          .prepare(
            "INSERT OR IGNORE INTO favorite_books (member_id, book_id) VALUES (?, ?)",
          )
          .bind(actor.id, book.id)
          .run();
      } else {
        await database()
          .prepare("DELETE FROM favorite_books WHERE member_id = ? AND book_id = ?")
          .bind(actor.id, book.id)
          .run();
      }
      return Response.json({ ok: true });
    }

    if (input.action === "addAttendance") {
      if (actor.role !== "admin") {
        return fail("Başka birini yönetici ekleyebilir.", 403);
      }
      const target = await getMember(input.targetId);
      if (!target || !Number.isInteger(input.meetingId)) {
        return fail("Katılımcı veya buluşma bulunamadı.");
      }
      const meeting = await database()
        .prepare("SELECT id FROM meetings WHERE id = ?")
        .bind(input.meetingId)
        .first();
      if (!meeting) return fail("Buluşma bulunamadı.", 404);
      await database()
        .prepare(
          "INSERT OR IGNORE INTO attendance (meeting_id, member_id, reading_status) VALUES (?, ?, 'unselected')",
        )
        .bind(input.meetingId, target.id)
        .run();
      return Response.json({ ok: true });
    }

    if (input.action === "confirmDetectedAttendance") {
      if (actor.role !== "admin") {
        return fail("Fotoğraftan katılımcı eklemeyi yönetici onaylayabilir.", 403);
      }
      if (!Array.isArray(input.targetIds)) return fail("Katılımcı seçimi geçersiz.");
      const targetIds = [...new Set(input.targetIds)];
      if (
        !Number.isInteger(input.meetingId)
        || targetIds.length < 1
        || targetIds.length > 30
        || targetIds.some((id) => !Number.isInteger(id) || id < 1)
      ) {
        return fail("Katılımcı seçimi geçersiz.");
      }
      const [meeting, ...targets] = await Promise.all([
        database().prepare("SELECT id FROM meetings WHERE id = ?").bind(input.meetingId).first(),
        ...targetIds.map((id) => getMember(id)),
      ]);
      if (!meeting) return fail("Buluşma bulunamadı.", 404);
      if (targets.some((target) => !target)) return fail("Katılımcılardan biri bulunamadı.", 404);
      await database().batch(
        targetIds.map((targetId) =>
          database()
            .prepare("INSERT OR IGNORE INTO attendance (meeting_id, member_id, reading_status) VALUES (?, ?, 'unselected')")
            .bind(input.meetingId, targetId),
        ),
      );
      return Response.json({ ok: true, added: targetIds.length });
    }

    if (input.action === "clearFaceReference") {
      const targetId = Number(input.targetId);
      if (!Number.isInteger(targetId)) return fail("Üye bulunamadı.");
      if (actor.role !== "admin" && actor.id !== targetId) {
        return fail("Bu yüz referansını kaldıramazsın.", 403);
      }
      const target = await database()
        .prepare("SELECT id, face_reference_media_key AS faceReferenceMediaKey FROM members WHERE id = ?")
        .bind(targetId)
        .first<{ id: number; faceReferenceMediaKey: string | null }>();
      if (!target) return fail("Üye bulunamadı.", 404);
      const statements = [
        database()
          .prepare("UPDATE members SET face_reference_media_key = NULL, face_recognition_consent = 0 WHERE id = ?")
          .bind(targetId),
      ];
      if (target.faceReferenceMediaKey) {
        statements.push(
          database().prepare("DELETE FROM media WHERE media_key = ?").bind(target.faceReferenceMediaKey),
        );
      }
      await database().batch(statements);
      return Response.json({ ok: true });
    }

    if (input.action === "deletePlan") {
      if (actor.role !== "admin") return fail("Planları yönetici değiştirebilir.", 403);
      if (!Number.isInteger(input.planId)) return fail("Plan bulunamadı.");
      await database()
        .prepare("DELETE FROM roadmap WHERE id = ?")
        .bind(input.planId)
        .run();
      return Response.json({ ok: true });
    }

    if (input.action === "editBook") {
      if (actor.role !== "admin") return fail("Kitap künyesini yönetici düzenleyebilir.", 403);
      const existing = await existingBook(input.bookId);
      if (!existing || !input.book || typeof input.book !== "object") {
        return fail("Kitap bulunamadı.", 404);
      }
      const book = bookValues(input.book);
      await database()
        .prepare(
          "UPDATE books SET title = ?, author = ?, publisher = ?, pages = ?, isbn = ?, cover_url = ?, source_url = ? WHERE id = ?",
        )
        .bind(
          book.title,
          book.author,
          book.publisher,
          book.pages,
          book.isbn,
          book.coverUrl,
          book.sourceUrl,
          existing.id,
        )
        .run();
      return Response.json({ ok: true });
    }

    if (input.action === "editMeeting") {
      if (actor.role !== "admin") return fail("Buluşmayı yönetici düzenleyebilir.", 403);
      if (
        !Number.isInteger(input.meetingId)
        || !validMeetingDate(input.date)
        || !clean(input.location, 180)
      ) {
        return fail("Buluşma tarihi ve yeri gerekli.");
      }
      const mapUrl = clean(input.mapUrl, 500);
      if (mapUrl && !/^https:\/\//.test(mapUrl)) {
        return fail("Harita bağlantısı https:// ile başlamalı.");
      }
      await database()
        .prepare(
          "UPDATE meetings SET date = ?, location = ?, map_url = ?, note = ?, reading_scope = ?, book_status = ? WHERE id = ?",
        )
        .bind(
          input.date,
          clean(input.location, 180),
          mapUrl || null,
          clean(input.note, 1000) || null,
          clean(input.readingScope, 180) || null,
          meetingBookStatus(input.bookStatus),
          input.meetingId,
        )
        .run();
      return Response.json({ ok: true });
    }

    return fail("Bilinmeyen işlem.");
  } catch (error) {
    console.error("Reading circle action failed", error);
    if (faceSchemaMissing(error)) {
      return fail("Yüz eşleştirme için önce 0004 migration'ını D1 veritabanına uygula.", 503);
    }
    if (profileSchemaMissing(error)) {
      return fail("Profil, favori ve devam özellikleri için önce 0003 migration'ını D1 veritabanına uygula.", 503);
    }
    return fail(
      error instanceof Error && error.message === "Kitap adı ve yazar gerekli."
        ? error.message
        : "İşlem kaydedilemedi. Yeniden dene.",
      503,
    );
  }
}
