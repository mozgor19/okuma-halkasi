import { getAuthenticatedMember, getState } from "@/db/store";

export const runtime = "edge";

export async function GET(request: Request) {
  const member = await getAuthenticatedMember(request);
  if (!member) return Response.json({ error: "Oturum gerekli." }, { status: 401 });

  try {
    return Response.json(
      { ...(await getState()), currentMemberId: member.id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not load reading circle", error);
    return Response.json({ error: "Kayıtlar yüklenemedi." }, { status: 503 });
  }
}
