import { NextResponse } from "next/server";
import { changeMemberPassword } from "@/db/accounts";
import { getAuthenticatedMember } from "@/db/store";
import {
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export const runtime = "edge";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Geçersiz istek kaynağı." }, { status: 403 });
  }

  const member = await getAuthenticatedMember(request);
  if (!member) {
    return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as {
    currentPassword?: unknown;
    newPassword?: unknown;
    confirmPassword?: unknown;
  } | null;
  const currentPassword = typeof body?.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
  const confirmPassword = typeof body?.confirmPassword === "string" ? body.confirmPassword : "";

  if (!currentPassword || currentPassword.length > 200 || !newPassword || newPassword.length > 200) {
    return NextResponse.json({ error: "Mevcut ve yeni şifre gerekli." }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "Yeni şifreler eşleşmiyor." }, { status: 400 });
  }

  try {
    const result = await changeMemberPassword(member.id, currentPassword, newPassword);
    if (!result.ok) {
      const status = result.reason === "migration-required" ? 503 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(
      SESSION_COOKIE,
      await createSessionToken(member.id, result.sessionVersion),
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
    console.error("Password change failed", error);
    return NextResponse.json({ error: "Şifre değiştirilemedi. Tekrar dene." }, { status: 503 });
  }
}
