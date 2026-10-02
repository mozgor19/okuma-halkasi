import { getAuthenticatedMember, getState } from "@/db/store";
import { isAdminRole } from "@/lib/types";

export const runtime = "edge";

export async function GET(request: Request) {
  const member = await getAuthenticatedMember(request);
  if (!member) return Response.json({ error: "Oturum gerekli." }, { status: 401 });

  try {
    const state = await getState();
    const members = isAdminRole(member.role)
      ? state.members
      : state.members.map((person) => person.id === member.id
          ? person
          : { ...person, faceReferenceMediaKey: null });
    const bookVotes = state.voteVisibility === "secret" && !isAdminRole(member.role)
      ? state.bookVotes.map((vote) => vote.memberId === member.id ? vote : { ...vote, memberId: 0 })
      : state.bookVotes;
    return Response.json(
      { ...state, members, bookVotes, currentMemberId: member.id },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not load reading circle", error);
    return Response.json({ error: "Kayıtlar yüklenemedi." }, { status: 503 });
  }
}
