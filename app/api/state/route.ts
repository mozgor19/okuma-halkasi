import { getState } from "@/db/store";
export const runtime = "edge";
export async function GET() {
  try { return Response.json(await getState(), { headers: { "Cache-Control": "no-store" } }); }
  catch (error) { console.error("Could not load reading circle", error); return Response.json({ error: "Kayıtlar yüklenemedi." }, { status: 503 }); }
}
