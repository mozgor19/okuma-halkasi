import { bucket, database, getMember } from "@/db/store";
export const runtime = "edge";

function imageType(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137,80,78,71,13,10,26,10].every((value, i) => bytes[i] === value)) return "image/png";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file"); const purpose = form.get("purpose");
    const actor = await getMember(Number(form.get("memberId")));
    if (!actor) return Response.json({ error: "Üye bulunamadı." }, { status: 403 });
    if (!(file instanceof File) || !["cover", "photo"].includes(String(purpose))) return Response.json({ error: "Bir fotoğraf seç." }, { status: 400 });
    if (file.size < 1 || file.size > 8 * 1024 * 1024) return Response.json({ error: "Görsel en fazla 8 MB olabilir." }, { status: 413 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const kind = imageType(bytes);
    if (!kind) return Response.json({ error: "JPG, PNG veya WebP görsel yükle." }, { status: 400 });
    const meetingId = Number(form.get("meetingId"));
    if (purpose === "photo" && (!Number.isInteger(meetingId) || !(await database().prepare("SELECT id FROM meetings WHERE id = ?").bind(meetingId).first()))) return Response.json({ error: "Buluşma bulunamadı." }, { status: 404 });
    const key = crypto.randomUUID();
    await bucket().put(key, bytes, { httpMetadata: { contentType: kind } });
    if (purpose === "photo") {
      try { await database().prepare("INSERT INTO photos (meeting_id, media_key, uploaded_by) VALUES (?, ?, ?)").bind(meetingId, key, actor.id).run(); }
      catch (error) { await bucket().delete(key); throw error; }
    }
    return Response.json({ url: `/api/media/${key}` });
  } catch (error) { console.error("Image upload failed", error); return Response.json({ error: "Görsel yüklenemedi. Tekrar dene." }, { status: 503 }); }
}
