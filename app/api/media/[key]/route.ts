import { database } from "@/db/store";
export const runtime = "edge";

type MediaRow = { data: number[]; contentType: string };

export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!/^[a-f0-9-]{36}$/.test(key)) return new Response("Not found", { status: 404 });
  try {
    const media = await database()
      .prepare("SELECT data, content_type AS contentType FROM media WHERE media_key = ?")
      .bind(key)
      .first<MediaRow>();
    if (!media || !Array.isArray(media.data)) return new Response("Not found", { status: 404 });
    return new Response(Uint8Array.from(media.data).buffer, { headers: { "Content-Type": media.contentType, "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { console.error("Image read failed", error); return new Response("Unavailable", { status: 503 }); }
}
