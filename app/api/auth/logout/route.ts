import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth";
import { groupCookieOptions, noStore, READING_GROUP_COOKIE, readingGroupsEnabled } from "@/lib/groups";

export const runtime = "edge";

export async function POST(request: Request) {
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
