import { NextResponse } from "next/server";
import { SESSION_COOKIE, sessionTokenFromRequest } from "@/lib/auth";
import { env } from "cloudflare:workers";
import { firebaseLocalSelected } from "@/lib/firebase-local-policy";
import { firebaseSelected } from "@/lib/firebase-auth-policy";
import { groupCookieOptions, noStore, READING_GROUP_COOKIE, readingGroupErrorResponse, readingGroupsEnabled } from "@/lib/groups";
import { sameOrigin, selfServiceEnabled } from "@/lib/onboarding-security";

export const runtime = "edge";

export async function POST(request: Request) {
  if (firebaseSelected(env)) {
    try { sameOrigin(request); await (await import("@/db/firebase-accounts")).revokeFirebaseSession(sessionTokenFromRequest(request)); }
    catch (error) { return readingGroupErrorResponse(error); }
  }
  if (firebaseLocalSelected(env)) {
    try {
      sameOrigin(request);
      await (await import("@/db/firebase-local-accounts")).revokeFirebaseLocalSession(sessionTokenFromRequest(request));
    } catch (error) { return readingGroupErrorResponse(error); }
  }
  if (selfServiceEnabled()) {
    try { sameOrigin(request); } catch (error) { return readingGroupErrorResponse(error); }
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  if (readingGroupsEnabled()) {
    response.cookies.set(READING_GROUP_COOKIE, "", groupCookieOptions(request, true));
    return noStore(response);
  }
  return response;
}
