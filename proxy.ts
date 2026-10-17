import { NextResponse, type NextRequest } from "next/server";
import { sessionAccountIsCurrent } from "@/db/accounts";
import {
  authIsConfigured,
  safeNextPath,
  SESSION_COOKIE,
  sessionIdentity,
} from "@/lib/auth";
import { noStore, ReadingGroupError, readingGroupErrorResponse, readingGroupsEnabled, resolveReadingGroup, resolveLegacyReadingGroup } from "@/lib/groups";
import { selfServiceEnabled } from "@/lib/onboarding-security";

const publicPaths = new Set(["/login", "/design-lab", "/api/auth/login", "/api/auth/logout", "/api/manifest"]);
const onboardingPublicPaths = new Set(["/register", "/verify-email", "/forgot-password", "/reset-password", "/join", "/support", "/api/onboarding/register", "/api/onboarding/verify-email", "/api/onboarding/forgot-password", "/api/onboarding/reset-password"]);
const publicAsset = /\.(?:css|js|map|svg|png|jpg|jpeg|webp|ico|woff2?)$/i;

function enforceLocalBrowserRequests<T extends Response>(response: T): T {
  response.headers.set("Content-Security-Policy", "connect-src 'self'");
  if (selfServiceEnabled()) {
    response.headers.set("Content-Security-Policy", "connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; object-src 'none'; base-uri 'self'; frame-ancestors 'none'");
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
  }
  if (readingGroupsEnabled()) noStore(response);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/onboarding/config") return enforceLocalBrowserRequests(NextResponse.next());
  if (onboardingPublicPaths.has(pathname)) {
    return enforceLocalBrowserRequests(selfServiceEnabled() ? NextResponse.next() : new NextResponse("Sayfa bulunamadı.", { status: 404 }));
  }
  if (!pathname.startsWith("/api/") && publicAsset.test(pathname)) return NextResponse.next();
  if (publicPaths.has(pathname) && pathname !== "/login") return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const identity = await sessionIdentity(session);
  let authenticated = false;
  try {
    authenticated = !!identity && await sessionAccountIsCurrent(identity);
  } catch (error) {
    console.error("Could not validate session account", error);
  }

  if (authenticated && !readingGroupsEnabled() && pathname === "/") {
    try { await resolveLegacyReadingGroup(request); }
    catch (error) { return enforceLocalBrowserRequests(readingGroupErrorResponse(error)); }
  }

  if (authenticated && readingGroupsEnabled() && (pathname === "/" || pathname === "/login")) {
    try {
      await resolveReadingGroup(request);
    } catch (error) {
      if (error instanceof ReadingGroupError && ["GROUP_SELECTION_REQUIRED", "GROUP_CHANGED", "GROUP_ACCESS_DENIED"].includes(error.code)) {
        const groupsUrl = new URL("/groups", request.url);
        const next = safeNextPath(pathname === "/login"
          ? request.nextUrl.searchParams.get("next")
          : pathname + request.nextUrl.search);
        if (next !== "/" && !next.startsWith("/groups")) groupsUrl.searchParams.set("next", next);
        return enforceLocalBrowserRequests(NextResponse.redirect(groupsUrl));
      }
      return enforceLocalBrowserRequests(readingGroupErrorResponse(error));
    }
  }

  if (pathname === "/login") {
    return enforceLocalBrowserRequests(
      authenticated
        ? NextResponse.redirect(new URL(safeNextPath(request.nextUrl.searchParams.get("next")), request.url))
        : NextResponse.next(),
    );
  }

  if (!authIsConfigured() || !authenticated) {
    if (pathname.startsWith("/api/")) {
      return enforceLocalBrowserRequests(
        NextResponse.json({ error: "Oturum gerekli." }, { status: 401 }),
      );
    }
    const loginUrl = new URL("/login", request.url);
    const returnTo = pathname + request.nextUrl.search;
    if (returnTo !== "/") loginUrl.searchParams.set("next", returnTo);
    return enforceLocalBrowserRequests(NextResponse.redirect(loginUrl));
  }

  return enforceLocalBrowserRequests(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
