import { NextResponse } from "next/server";
import { authenticateAccount, passwordRehashRequired } from "@/db/accounts";
import { getMember } from "@/db/store";
import {
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

  try {
    const account = await authenticateAccount(username, password);
    const member = account ? await getMember(account.memberId) : null;
    if (!account || !member) {
      return NextResponse.json({ error: "Kullanıcı adı veya şifre yanlış." }, { status: 401 });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      SESSION_COOKIE,
      await createSessionToken(member.id, account.sessionVersion),
      {
        httpOnly: true,
        secure: new URL(request.url).protocol === "https:",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_MAX_AGE,
      },
    );
    return response;
  } catch (error) {
    console.error("Login failed", error);
    if (passwordRehashRequired(error)) {
      return NextResponse.json(
        {
          error: "Bu hesabın parola kaydı güncellenmeli. Yönetici MEMBER_CREDENTIALS Secret'ını geçici olarak geri eklemeli.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: "Giriş şu anda tamamlanamıyor." }, { status: 503 });
  }
}
