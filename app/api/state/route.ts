import { getAuthenticatedMember, getState } from "@/db/store";
import { readingGroupContext } from "@/db/database";
import { readingGroupsEnabled, withReadingGroup } from "@/lib/groups";
import { isAdminRole } from "@/lib/types";
import { faceRecognitionEnabled } from "@/lib/feature-policy";
import { deferMeetingChanges } from "@/db/meeting-mail";

export const runtime = "edge";

export const GET = withReadingGroup(handleGET);

async function handleGET(request: Request) {
  const member = await getAuthenticatedMember(request);
  if (!member) return Response.json({ error: "Oturum gerekli." }, { status: 401 });

  try {
    const state = await getState();
    if (state.meetingChanges?.length) deferMeetingChanges();
    const faces = faceRecognitionEnabled();
    const members = !faces ? state.members.map((person) => ({ ...person, faceReferenceMediaKey: null })) : isAdminRole(member.role)
      ? state.members
      : state.members.map((person) => person.id === member.id
          ? person
          : { ...person, faceReferenceMediaKey: null });
    const bookVotes = state.voteVisibility === "secret" && !isAdminRole(member.role)
      ? state.bookVotes.map((vote) => vote.memberId === member.id ? vote : { ...vote, memberId: 0 })
      : state.bookVotes;
    const group = readingGroupContext()?.group;
    return Response.json(
      { ...state, members, bookVotes, currentMemberId: member.id, faceRecognitionEnabled: faces,
        ...(group && readingGroupsEnabled() ? { readingGroup: group } : {}),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Could not load reading circle", error);
    return Response.json({ error: "Kayıtlar yüklenemedi." }, { status: 503 });
  }
}
