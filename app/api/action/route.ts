import { clubSchemaMissing, database, faceSchemaMissing, getAuthenticatedMember, getMember, profileSchemaMissing, rsvpSchemaMissing } from "@/db/store";
import { meetingRsvpIsOpen } from "@/lib/meeting-time";
import { identityDatabase, readingGroupContext } from "@/db/database";
import { ReadingGroupError, readingGroupErrorResponse, readingGroupsEnabled, withReadingGroup } from "@/lib/groups";
import { isAdminRole, isSuperAdminRole } from "@/lib/types";
import { faceRecognitionEnabled } from "@/lib/feature-policy";

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
  photoId?: number;
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
  currentPage?: number | null;
  roadmapId?: number | null;
  voteVisibility?: string;
  trashType?: string;
  guestName?: string;
  role?: string;
};

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
const fail = (message: string, status = 400) =>
  Response.json({ error: message }, { status });

function safeCover(value: unknown) {
  const url = clean(value, 500);
  const group = readingGroupContext()?.group;
  if (group && /^\/api\/media\/[a-f0-9-]{36}(?:\?group=[a-zA-Z0-9_-]+)?$/.test(url)) {
    const parsed = new URL(url, "https://local.invalid");
    const requestedGroup = parsed.searchParams.get("group");
    if (requestedGroup !== null && requestedGroup !== group.id) {
      throw new ReadingGroupError("INVALID_COVER", 400, "Kapak görseli başka bir okuma grubuna ait.");
    }
    return parsed.pathname;
  }
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
    .insert("books", "title, author, publisher, pages, isbn, cover_url, source_url", "?, ?, ?, ?, ?, ?, ?")
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
    .read("SELECT id FROM books WHERE id = ?")
    .bind(bookId)
    .first<{ id: number }>();
}

function validMeetingDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value);
}

function meetingBookStatus(value: unknown): "continuing" | "completed" {
  return value === "continuing" ? "continuing" : "completed";
}

export const POST = withReadingGroup(handlePOST);

async function handlePOST(request: Request) {
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
      if (input.action === "createMeeting" && !isAdminRole(actor.role)) {
        return fail("Buluşmayı yönetici oluşturabilir.", 403);
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
        if (!isAdminRole(actor.role)) {
          return fail("Planı yönetici buluşmaya taşıyabilir.", 403);
        }
        const plan = await database()
          .read("SELECT book_id AS bookId FROM roadmap WHERE id = ? AND deleted_at IS NULL")
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
          .insert("roadmap", "book_id, planned_date, note, created_by", "?, ?, ?, ?")
          .bind(
            bookId,
            isAdminRole(actor.role) ? input.date || null : null,
            clean(input.note, 1000) || null,
            actor.id,
          )
          .run();
        return Response.json({ ok: true });
      }

      const insert = database()
        .insert("meetings", "book_id, date, location, map_url, note, reading_scope, book_status, created_by", "?, ?, ?, ?, ?, ?, ?, ?")
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
            database().delete("book_votes", "roadmap_id = ?").bind(input.planId),
            database().delete("roadmap", "id = ?").bind(input.planId),
          ]))[0]
        : await insert.run();
      return Response.json({ ok: true, meetingId: result.meta.last_row_id });
    }

    if (input.action === "review") {
      const meetingId = Number(input.meetingId);
      if (!["read", "partial", "unread"].includes(input.readingStatus ?? "")) {
        return fail("Okuma durumunu seç.");
      }
      const hasRating = input.rating !== null && input.rating !== undefined;
      const rating = hasRating ? Number(input.rating) : null;
      if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 10)) {
        return fail("Puan 1-10 arasında olmalıdır.");
      }
      if (input.readingStatus !== "unread" && rating === null) {
        return fail("Okuduysan veya kısmen okuduysan puan vermelisin.");
      }
      const meeting = Number.isInteger(meetingId)
        ? await database()
            .read("SELECT b.pages FROM meetings m JOIN books b ON b.id = m.book_id WHERE m.id = ? AND m.deleted_at IS NULL")
            .bind(meetingId)
            .first<{ pages: number | null }>()
        : null;
      if (!meeting) return fail("Buluşma bulunamadı.", 404);
      const currentPage = input.currentPage === null || input.currentPage === undefined
        ? null
        : Number(input.currentPage);
      if (
        currentPage !== null
        && (!Number.isInteger(currentPage) || currentPage < 0 || (meeting.pages && currentPage > meeting.pages))
      ) {
        return fail("Okuma sayfası kitap uzunluğuyla uyumlu değil.");
      }
      const statements = [
        database()
          .insert("attendance", "meeting_id, member_id, reading_status, current_page", "?, ?, ?, ?", {"conflict":"meeting_id, member_id","update":"reading_status = excluded.reading_status, current_page = excluded.current_page"})
          .bind(meetingId, actor.id, input.readingStatus, currentPage),
        rating === null
          ? database()
              .delete("reviews", "meeting_id = ? AND member_id = ?")
              .bind(meetingId, actor.id)
          : database()
              .insert("reviews", "meeting_id, member_id, rating, comment", "?, ?, ?, ?", {"conflict":"meeting_id, member_id","update":"rating = excluded.rating, comment = excluded.comment, updated_at = CURRENT_TIMESTAMP"})
              .bind(meetingId, actor.id, rating, clean(input.comment, 1000) || null),
      ];
      await database().batch(statements);
      return Response.json({ ok: true });
    }

    if (input.action === "setMeetingRsvp") {
      const meetingId = Number(input.meetingId);
      let meeting: { id: number; date: string } | null = null;
      if (Number.isInteger(meetingId)) {
        try {
          meeting = await database()
            .read("SELECT id, date FROM meetings WHERE id = ? AND deleted_at IS NULL")
            .bind(meetingId)
            .first<{ id: number; date: string }>();
        } catch (error) {
          if (!clubSchemaMissing(error)) throw error;
          meeting = await database()
            .read("SELECT id, date FROM meetings WHERE id = ?")
            .bind(meetingId)
            .first<{ id: number; date: string }>();
        }
      }
      if (!meeting) return fail("Buluşma bulunamadı.", 404);
      if (!meetingRsvpIsOpen(meeting, new Date())) {
        return fail("Geçmiş buluşmalar için geliş durumu değiştirilemez.", 409);
      }
      if (input.active) {
        await database()
          .insert("meeting_rsvps", "meeting_id, member_id", "?, ?", {"conflict":"meeting_id, member_id","update":"updated_at = CURRENT_TIMESTAMP"})
          .bind(meeting.id, actor.id)
          .run();
      } else {
        await database()
          .delete("meeting_rsvps", "meeting_id = ? AND member_id = ?")
          .bind(meeting.id, actor.id)
          .run();
      }
      return Response.json({ ok: true });
    }

    if (input.action === "toggleFavorite") {
      const book = await existingBook(input.bookId);
      if (!book) return fail("Kitap bulunamadı.", 404);
      if (input.active) {
        await database()
          .insert("favorite_books", "member_id, book_id", "?, ?", {"ignore":true})
          .bind(actor.id, book.id)
          .run();
      } else {
        await database()
          .delete("favorite_books", "member_id = ? AND book_id = ?")
          .bind(actor.id, book.id)
          .run();
      }
      return Response.json({ ok: true });
    }


    if (input.action === "voteBook") {
      const roadmapId = Number(input.roadmapId);
      if (!Number.isInteger(roadmapId)) return fail("Kitap adayı bulunamadı.");
      const candidate = await database()
        .read("SELECT id FROM roadmap WHERE id = ? AND deleted_at IS NULL")
        .bind(roadmapId)
        .first();
      if (!candidate) return fail("Kitap adayı bulunamadı.", 404);
      if (input.active) {
        await database()
          .insert("book_votes", "member_id, roadmap_id", "?, ?", {"conflict":"member_id","update":"roadmap_id = excluded.roadmap_id, created_at = CURRENT_TIMESTAMP"})
          .bind(actor.id, roadmapId)
          .run();
      } else {
        await database()
          .delete("book_votes", "member_id = ? AND roadmap_id = ?")
          .bind(actor.id, roadmapId)
          .run();
      }
      return Response.json({ ok: true });
    }

    if (input.action === "setVoteVisibility") {
      if (!isAdminRole(actor.role)) return fail("Oylama ayarını yönetici değiştirebilir.", 403);
      if (!["open", "secret"].includes(input.voteVisibility ?? "")) {
        return fail("Oylama görünürlüğü geçersiz.");
      }
      await database()
        .insert("club_settings", "key, value", "'book_vote_visibility', ?", {"conflict":"key","update":"value = excluded.value"})
        .bind(input.voteVisibility)
        .run();
      return Response.json({ ok: true });
    }

    if (input.action === "clearBookVotes") {
      if (!isAdminRole(actor.role)) return fail("Oyları yönetici sıfırlayabilir.", 403);
      await database().delete("book_votes").run();
      return Response.json({ ok: true });
    }

    if (input.action === "addGuest") {
      if (!isAdminRole(actor.role)) return fail("Misafir katılımcıyı yönetici ekleyebilir.", 403);
      const meetingId = Number(input.meetingId);
      const name = clean(input.guestName, 80);
      if (!Number.isInteger(meetingId) || name.length < 2) {
        return fail("Misafir adı ve buluşma gerekli.");
      }
      const meeting = await database()
        .read("SELECT id FROM meetings WHERE id = ? AND deleted_at IS NULL")
        .bind(meetingId)
        .first();
      if (!meeting) return fail("Buluşma bulunamadı.", 404);
      const colors = ["#5e8b88", "#bd8464", "#769e9a", "#9881a5", "#a08b65", "#6d8eaa"];
      const color = colors[name.length % colors.length];
      const result = await database()
        .insert("members", "name, role, color, is_guest, guest_meeting_id", "?, 'member', ?, 1, ?")
        .bind(name, color, meetingId)
        .run();
      const guestId = Number(result.meta.last_row_id);
      await database()
        .insert("attendance", "meeting_id, member_id, reading_status", "?, ?, 'unselected'")
        .bind(meetingId, guestId)
        .run();
      return Response.json({ ok: true, memberId: guestId });
    }

    if (input.action === "deleteMeeting") {
      if (!isAdminRole(actor.role)) return fail("Buluşmayı yönetici silebilir.", 403);
      if (!Number.isInteger(input.meetingId)) return fail("Buluşma bulunamadı.");
      await database()
        .update("meetings", "deleted_at = CURRENT_TIMESTAMP", "id = ? AND deleted_at IS NULL")
        .bind(input.meetingId)
        .run();
      return Response.json({ ok: true });
    }

    if (input.action === "restoreTrash") {
      if (!isAdminRole(actor.role)) return fail("Çöp kutusunu yönetici düzenleyebilir.", 403);
      const id = Number(input.targetId);
      if (!Number.isInteger(id) || !["meeting", "plan"].includes(input.trashType ?? "")) {
        return fail("Çöp kaydı geçersiz.");
      }
      const table = input.trashType === "meeting" ? "meetings" : "roadmap";
      await database()
        .update(table, "deleted_at = NULL", "id = ? AND deleted_at IS NOT NULL")
        .bind(id)
        .run();
      return Response.json({ ok: true });
    }

    if (input.action === "purgeTrash") {
      if (!isSuperAdminRole(actor.role)) return fail("Kalıcı silmeyi yalnızca ana yönetici yapabilir.", 403);
      const id = Number(input.targetId);
      if (!Number.isInteger(id) || !["meeting", "plan"].includes(input.trashType ?? "")) {
        return fail("Çöp kaydı geçersiz.");
      }
      if (input.trashType === "plan") {
        const plan = await database()
          .read("SELECT id FROM roadmap WHERE id = ? AND deleted_at IS NOT NULL")
          .bind(id)
          .first();
        if (!plan) return fail("Silinen plan bulunamadı.", 404);
        await database().batch([
          database().delete("book_votes", "roadmap_id = ?").bind(id),
          database().delete("roadmap", "id = ?").bind(id),
        ]);
        return Response.json({ ok: true });
      }

      const meeting = await database()
        .read("SELECT id FROM meetings WHERE id = ? AND deleted_at IS NOT NULL")
        .bind(id)
        .first();
      if (!meeting) return fail("Silinen buluşma bulunamadı.", 404);
      const photoRows = (await database()
        .read("SELECT media_key AS mediaKey FROM photos WHERE meeting_id = ?")
        .bind(id)
        .all<{ mediaKey: string }>()).results;
      const guestRows = (await database()
        .read("SELECT id FROM members WHERE is_guest = 1 AND guest_meeting_id = ?")
        .bind(id)
        .all<{ id: number }>()).results;
      const statements = [
        database().delete("reviews", "meeting_id = ?").bind(id),
        database().delete("attendance", "meeting_id = ?").bind(id),
        database().delete("meeting_rsvps", "meeting_id = ?").bind(id),
        database().delete("photos", "meeting_id = ?").bind(id),
        ...photoRows.map((photo) =>
          database().delete("media", "media_key = ?").bind(photo.mediaKey)
        ),
        database().delete("meetings", "id = ?").bind(id),
        ...guestRows.flatMap((guest) => [
          database().delete("favorite_books", "member_id = ?").bind(guest.id),
          database().delete("book_votes", "member_id = ?").bind(guest.id),
          ...(!readingGroupsEnabled()
            ? [identityDatabase().prepare("DELETE FROM member_accounts WHERE member_id = ?").bind(guest.id)]
            : []),
          database().delete("members", "id = ?").bind(guest.id),
        ]),
      ];
      await database().batch(statements);
      return Response.json({ ok: true });
    }

    if (input.action === "deletePhoto") {
      if (!isAdminRole(actor.role)) {
        return fail("Fotoğrafları yalnızca yönetici silebilir.", 403);
      }
      if (!Number.isInteger(input.photoId)) return fail("Fotoğraf bulunamadı.");
      const photo = await database()
        .read("SELECT media_key AS mediaKey FROM photos WHERE id = ?")
        .bind(input.photoId)
        .first<{ mediaKey: string }>();
      if (!photo) return fail("Fotoğraf bulunamadı.", 404);
      await database().batch([
        database().delete("photos", "id = ?").bind(input.photoId),
        database().delete("media", "media_key = ?").bind(photo.mediaKey),
      ]);
      return Response.json({ ok: true });
    }

    if (input.action === "addAttendance") {
      if (!isAdminRole(actor.role)) {
        return fail("Başka birini yönetici ekleyebilir.", 403);
      }
      const target = Number.isInteger(input.targetId)
        ? await database().read("SELECT id, is_guest AS isGuest FROM members WHERE id = ?").bind(input.targetId).first<{ id: number; isGuest: number }>()
        : null;
      if (!target || target.isGuest || !Number.isInteger(input.meetingId)) {
        return fail("Katılımcı veya buluşma bulunamadı.");
      }
      const meeting = await database()
        .read("SELECT id FROM meetings WHERE id = ? AND deleted_at IS NULL")
        .bind(input.meetingId)
        .first();
      if (!meeting) return fail("Buluşma bulunamadı.", 404);
      await database()
        .insert("attendance", "meeting_id, member_id, reading_status", "?, ?, 'unselected'", {"ignore":true})
        .bind(input.meetingId, target.id)
        .run();
      return Response.json({ ok: true });
    }

    if (input.action === "confirmDetectedAttendance") {
      if (!faceRecognitionEnabled()) return Response.json({ error: "Yüz eşleştirme bu ortamda kapalı." }, { status: 403 });
      if (!isAdminRole(actor.role)) {
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
        database().read("SELECT id FROM meetings WHERE id = ? AND deleted_at IS NULL").bind(input.meetingId).first(),
        ...targetIds.map((id) => getMember(id)),
      ]);
      if (!meeting) return fail("Buluşma bulunamadı.", 404);
      if (targets.some((target) => !target)) return fail("Katılımcılardan biri bulunamadı.", 404);
      await database().batch(
        targetIds.map((targetId) =>
          database()
            .insert("attendance", "meeting_id, member_id, reading_status", "?, ?, 'unselected'", {"ignore":true})
            .bind(input.meetingId, targetId),
        ),
      );
      return Response.json({ ok: true, added: targetIds.length });
    }

    if (input.action === "setMemberRole") {
      if (!isSuperAdminRole(actor.role)) return fail("Yönetici atamasını yalnızca ana yönetici yapabilir.", 403);
      const targetId = Number(input.targetId);
      if (!Number.isInteger(targetId) || !["admin", "member"].includes(input.role ?? "")) return fail("Üye veya rol geçersiz.");
      if (targetId === actor.id) return fail("Ana yönetici kendi rolünü değiştiremez.", 403);
      const target = await database()
        .read("SELECT id, role, is_guest AS isGuest FROM members WHERE id = ?")
        .bind(targetId)
        .first<{ id: number; role: string; isGuest: number }>();
      if (!target || target.isGuest) return fail("Üye bulunamadı.", 404);
      if (target.role === "super_admin") return fail("Ana yönetici rolü bu ekrandan değiştirilemez.", 403);
      await database().update("members", "role = ?", "id = ?").bind(input.role, targetId).run();
      return Response.json({ ok: true });
    }

    if (input.action === "clearFaceReference") {
      const targetId = Number(input.targetId);
      if (!Number.isInteger(targetId)) return fail("Üye bulunamadı.");
      if (!isSuperAdminRole(actor.role) && actor.id !== targetId) {
        return fail("Bu yüz referansını kaldıramazsın.", 403);
      }
      const target = await database()
        .read("SELECT id, face_reference_media_key AS faceReferenceMediaKey FROM members WHERE id = ?")
        .bind(targetId)
        .first<{ id: number; faceReferenceMediaKey: string | null }>();
      if (!target) return fail("Üye bulunamadı.", 404);
      const statements = [
        database()
          .update("members", "face_reference_media_key = NULL, face_recognition_consent = 0", "id = ?")
          .bind(targetId),
      ];
      if (target.faceReferenceMediaKey) {
        statements.push(
          database().delete("media", "media_key = ?").bind(target.faceReferenceMediaKey),
        );
      }
      await database().batch(statements);
      return Response.json({ ok: true });
    }

    if (input.action === "deletePlan") {
      if (!isAdminRole(actor.role)) return fail("Planları yönetici değiştirebilir.", 403);
      if (!Number.isInteger(input.planId)) return fail("Plan bulunamadı.");
      await database()
        .update("roadmap", "deleted_at = CURRENT_TIMESTAMP", "id = ? AND deleted_at IS NULL")
        .bind(input.planId)
        .run();
      return Response.json({ ok: true });
    }

    if (input.action === "editBook") {
      if (!isAdminRole(actor.role)) return fail("Kitap künyesini yönetici düzenleyebilir.", 403);
      const existing = await existingBook(input.bookId);
      if (!existing || !input.book || typeof input.book !== "object") {
        return fail("Kitap bulunamadı.", 404);
      }
      const book = bookValues(input.book);
      await database()
        .update("books", "title = ?, author = ?, publisher = ?, pages = ?, isbn = ?, cover_url = ?, source_url = ?", "id = ?")
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
      if (!isAdminRole(actor.role)) return fail("Buluşmayı yönetici düzenleyebilir.", 403);
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
        .update("meetings", "date = ?, location = ?, map_url = ?, note = ?, reading_scope = ?, book_status = ?", "id = ? AND deleted_at IS NULL")
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
    if (error instanceof ReadingGroupError) return readingGroupErrorResponse(error);
    console.error("Reading circle action failed", error);
    if (rsvpSchemaMissing(error)) {
      return fail("Buluşma paylaşımı ve geliş bildirimi için önce 0007 migration'ını D1 veritabanına uygula.", 503);
    }
    if (clubSchemaMissing(error)) {
      return fail("Oylama, çöp kutusu, misafir ve okuma ilerlemesi için önce 0005 migration'ını D1 veritabanına uygula.", 503);
    }
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
