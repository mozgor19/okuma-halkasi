import { NextResponse, type NextRequest } from "next/server";
import { sessionAccountIsCurrent } from "@/db/accounts";
import {
  authIsConfigured,
  safeNextPath,
  SESSION_COOKIE,
  sessionIdentity,
} from "@/lib/auth";
import { noStore, ReadingGroupError, readingGroupErrorResponse, readingGroupsEnabled, resolveReadingGroup, resolveLegacyReadingGroup } from "@/lib/groups";

const publicPaths = new Set(["/login", "/design-lab", "/api/auth/login", "/api/auth/logout"]);
const publicAsset = /\.(?:css|js|map|svg|png|jpg|jpeg|webp|ico|woff2?)$/i;

function enforceLocalBrowserRequests<T extends Response>(response: T): T {
  response.headers.set("Content-Security-Policy", "connect-src 'self'");
  if (readingGroupsEnabled()) noStore(response);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
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
