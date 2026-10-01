import { database, faceSchemaMissing, getAuthenticatedMember, profileSchemaMissing } from "@/db/store";

export const runtime = "edge";

const MAX_STORED_IMAGE_BYTES = 1_800_000;

function imageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8
    && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12
    && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF"
    && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export async function POST(request: Request) {
  try {
    const actor = await getAuthenticatedMember(request);
    if (!actor) return Response.json({ error: "Oturum gerekli." }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    const purpose = String(form.get("purpose"));
    if (!(file instanceof File) || !["cover", "photo", "avatar", "faceReference"].includes(purpose)) {
      return Response.json({ error: "Bir fotoğraf seç." }, { status: 400 });
    }
    if (file.size < 1 || file.size > MAX_STORED_IMAGE_BYTES) {
      return Response.json(
        { error: "İşlenen görsel en fazla 1,8 MB olabilir." },
        { status: 413 },
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = imageType(bytes);
    if (!kind) {
      return Response.json(
        { error: "JPG, PNG veya WebP görsel yükle." },
        { status: 400 },
      );
    }

    const meetingId = Number(form.get("meetingId"));
    if (
      purpose === "photo"
      && (
        !Number.isInteger(meetingId)
        || !(await database().prepare("SELECT id FROM meetings WHERE id = ?").bind(meetingId).first())
      )
    ) {
      return Response.json({ error: "Buluşma bulunamadı." }, { status: 404 });
    }

    const targetMemberId = Number(form.get("targetMemberId"));
    const faceTarget = purpose === "faceReference" && Number.isInteger(targetMemberId)
      ? await database()
          .prepare("SELECT id, face_reference_media_key AS faceReferenceMediaKey FROM members WHERE id = ?")
          .bind(targetMemberId)
          .first<{ id: number; faceReferenceMediaKey: string | null }>()
      : null;
    if (
      purpose === "faceReference"
      && (
        !faceTarget
        || (actor.role !== "admin" && actor.id !== targetMemberId)
      )
    ) {
      return Response.json(
        { error: faceTarget ? "Bu referans fotoğrafını değiştiremezsin." : "Üye bulunamadı." },
        { status: faceTarget ? 403 : 404 },
      );
    }

    const key = crypto.randomUUID();
    const db = database();
    const mediaInsert = db
      .prepare("INSERT INTO media (media_key, content_type, data) VALUES (?, ?, ?)")
      .bind(key, kind, bytes);

    if (purpose === "photo") {
      await db.batch([
        mediaInsert,
        db
          .prepare(
            "INSERT INTO photos (meeting_id, media_key, uploaded_by) VALUES (?, ?, ?)",
          )
          .bind(meetingId, key, actor.id),
      ]);
    } else if (purpose === "avatar") {
      await db.batch([
        mediaInsert,
        db
          .prepare("UPDATE members SET avatar_media_key = ? WHERE id = ?")
          .bind(key, actor.id),
      ]);
    } else if (purpose === "faceReference" && faceTarget) {
      await db.batch([
        mediaInsert,
        db
          .prepare("UPDATE members SET face_reference_media_key = ?, face_recognition_consent = 1 WHERE id = ?")
          .bind(key, faceTarget.id),
      ]);
      if (faceTarget.faceReferenceMediaKey) {
        await db
          .prepare("DELETE FROM media WHERE media_key = ?")
          .bind(faceTarget.faceReferenceMediaKey)
          .run();
      }
    } else {
      await mediaInsert.run();
    }

    return Response.json({ url: `/api/media/${key}`, mediaKey: key });
  } catch (error) {
    console.error("Image upload failed", error);
    if (faceSchemaMissing(error)) {
      return Response.json(
        { error: "Yüz eşleştirme için önce 0004 migration'ını D1 veritabanına uygula." },
        { status: 503 },
      );
    }
    if (profileSchemaMissing(error)) {
      return Response.json(
        { error: "Profil fotoğrafı için önce 0003 migration'ını D1 veritabanına uygula." },
        { status: 503 },
      );
    }
    return Response.json(
      { error: "Görsel yüklenemedi. Tekrar dene." },
      { status: 503 },
    );
  }
}
