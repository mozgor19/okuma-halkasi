import { NextResponse } from "next/server";
import {
  authIsConfigured,
  createSessionToken,
  passwordIsValid,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export const runtime = "edge";

export async function POST(request: Request) {
  if (!authIsConfigured()) {
    return NextResponse.json(
      { error: "Giriş henüz yapılandırılmadı." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null) as { password?: unknown } | null;
  const password = typeof body?.password === "string" ? body.password : "";
  if (!password || password.length > 200 || !(await passwordIsValid(password))) {
    return NextResponse.json({ error: "Şifre yanlış." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: new URL(request.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}
