import { bucket } from "@/db/store";
export const runtime = "edge";
export async function GET(_request: Request, context: { params: Promise<{ key: string }> }) {
  const { key } = await context.params;
  if (!/^[a-f0-9-]{36}$/.test(key)) return new Response("Not found", { status: 404 });
  try {
    const object = await bucket().get(key);
    if (!object) return new Response("Not found", { status: 404 });
    return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "public, max-age=3600", "X-Content-Type-Options": "nosniff" } });
  } catch (error) { console.error("Image read failed", error); return new Response("Unavailable", { status: 503 }); }
}
