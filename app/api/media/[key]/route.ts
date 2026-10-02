import { database, faceSchemaMissing, getAuthenticatedMember } from "@/db/store";
import { isAdminRole } from "@/lib/types";
export const runtime = "edge";

type MediaRow = { data: number[]; contentType: string };
type ReferenceOwner = { id: number };

export async function GET(request: Request, context: { params: Promise<{ key: string }> }) {
  const actor = await getAuthenticatedMember(request);
  if (!actor) return new Response("Unauthorized", { status: 401 });

  const { key } = await context.params;
  if (!/^[a-f0-9-]{36}$/.test(key)) return new Response("Not found", { status: 404 });
  try {
    let referenceOwner: ReferenceOwner | null = null;
    try {
      referenceOwner = await database()
        .prepare("SELECT id FROM members WHERE face_reference_media_key = ?")
        .bind(key)
        .first<ReferenceOwner>();
    } catch (error) {
      if (!faceSchemaMissing(error)) throw error;
    }
    if (referenceOwner && !isAdminRole(actor.role) && actor.id !== referenceOwner.id) {
      return new Response("Forbidden", { status: 403 });
    }

    const media = await database()
      .prepare("SELECT data, content_type AS contentType FROM media WHERE media_key = ?")
      .bind(key)
      .first<MediaRow>();
    if (!media || !Array.isArray(media.data)) return new Response("Not found", { status: 404 });
    return new Response(Uint8Array.from(media.data).buffer, {
      headers: {
        "Content-Type": media.contentType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Image read failed", error);
    return new Response("Unavailable", { status: 503 });
  }
}
