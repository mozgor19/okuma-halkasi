import { NextResponse } from "next/server";
import { getMember } from "@/db/store";
import {
  authenticateMember,
  authConfigurationIssue,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export const runtime = "edge";

export async function POST(request: Request) {
  const configurationIssue = authConfigurationIssue();
  if (configurationIssue) {
    return NextResponse.json({ error: configurationIssue }, { status: 503 });
  }

  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || username.length > 40 || !password || password.length > 200) {
    return NextResponse.json({ error: "Kullanıcı adı veya şifre yanlış." }, { status: 401 });
  }

  const memberId = await authenticateMember(username, password);
  const member = memberId ? await getMember(memberId) : null;
  if (!member) {
    return NextResponse.json({ error: "Kullanıcı adı veya şifre yanlış." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(member.id), {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
