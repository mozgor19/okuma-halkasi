import { NextResponse } from "next/server";
import { authenticateAccount, passwordRehashRequired } from "@/db/accounts";
import { getMember } from "@/db/store";
import { identityDatabase } from "@/db/database";
import { jsonBody, rateLimit, sameOrigin, selfServiceEnabled } from "@/lib/onboarding-security";
import {
  accountReadingGroups,
  groupCookieOptions,
  legacyAccountReadingGroup,
  noStore,
  READING_GROUP_COOKIE,
  ReadingGroupError,
  readingGroupErrorResponse,
  readingGroupsEnabled,
} from "@/lib/groups";
import {
  authConfigurationIssue,
  createSessionToken,
  SESSION_COOKIE,
  SESSION_MAX_AGE,
} from "@/lib/auth";

export const runtime = "edge";

export async function POST(request: Request) {
  const response = await handlePOST(request);
  return readingGroupsEnabled() ? noStore(response) : response;
}

async function handlePOST(request: Request) {
  const configurationIssue = authConfigurationIssue();
  if (configurationIssue) {
    return NextResponse.json({ error: configurationIssue }, { status: 503 });
  }

  let body: { username?: unknown; password?: unknown } | null;
  try {
    if (selfServiceEnabled()) {
      sameOrigin(request);
      await rateLimit(request, "login-ip", 30);
    }
    body = (selfServiceEnabled() ? await jsonBody(request) : await request.json().catch(() => null)) as typeof body;
    if (selfServiceEnabled()) await rateLimit(request, "login-username", 15, 900, typeof body?.username === "string" ? body.username.trim().toLowerCase().slice(0, 40) : "invalid");
  } catch (error) { return readingGroupErrorResponse(error); }
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!username || username.length > 40 || !password || password.length > 200) {
    return NextResponse.json({ error: "Kullanıcı adı veya şifre yanlış." }, { status: 401 });
  }

  try {
    const account = await authenticateAccount(username, password);
    const member = account ? await getMember(account.memberId, identityDatabase()) : null;
    if (!account || !member) {
      return NextResponse.json({ error: "Kullanıcı adı veya şifre yanlış." }, { status: 401 });
    }

    const groups = readingGroupsEnabled() ? await accountReadingGroups(account.memberId, selfServiceEnabled()) : null;
    if (!groups) await legacyAccountReadingGroup(account.memberId);
    const response = NextResponse.json(groups
      ? { ok: true, next: groups.length === 1 ? "/" : "/groups", ...(selfServiceEnabled() ? { selfService: true } : {}) }
      : { ok: true });
    if (groups) {
      const groupId = groups.length === 1 ? groups[0].id : null;
      response.cookies.set(READING_GROUP_COOKIE, groupId ?? "", groupCookieOptions(request, groupId === null));
    }
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
    if (error instanceof ReadingGroupError) return readingGroupErrorResponse(error);
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
