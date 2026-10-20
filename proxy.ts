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
import { browserSecurityHeaders } from "@/lib/web-security";
import { firebaseLocalConfiguration, firebaseLocalSelected } from "@/lib/firebase-local-policy";
import { firebaseConfiguration, firebaseSelected } from "@/lib/firebase-auth-policy";
import { productionOriginRedirect } from "@/lib/production-origin";

const publicPaths = new Set(["/login", "/design-lab", "/api/auth/login", "/api/auth/logout", "/api/manifest"]);
const onboardingPublicPaths = new Set(["/register", "/verify-email", "/forgot-password", "/reset-password", "/join", "/support", "/privacy", "/terms", "/auth/email", "/api/onboarding/firebase-action", "/api/onboarding/register", "/api/onboarding/verify-email", "/api/onboarding/forgot-password", "/api/onboarding/reset-password"]);
const publicAsset = /\.(?:css|js|map|svg|png|jpg|jpeg|webp|ico|woff2?)$/i;
const publicShell = new Set(["/koru.webmanifest", "/offline.html"]);

function enforceSecurity<T extends Response>(response: T, nonce?: string): T {
  if (env.STAGING_ENVIRONMENT === "true") response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  const strict = readingGroupsEnabled() && env.APPLICATION_BRAND === "Koru";
  for (const [key, value] of Object.entries(browserSecurityHeaders(selfServiceEnabled(), strict ? nonce : undefined, process.env.NODE_ENV === "development"))) response.headers.set(key, value);
  if (nonce) response.headers.set("Cache-Control", "private, no-store");
  if (readingGroupsEnabled()) noStore(response);
  return response;
}

export async function proxy(request: NextRequest) {
  const canonical = productionOriginRedirect(request.url, env);
  if (canonical) {
    // Mutations and credentials must be submitted again at the canonical origin.
    return enforceSecurity(["GET", "HEAD"].includes(request.method)
      ? NextResponse.redirect(canonical, 308)
      : NextResponse.json({ code: "ORIGIN_MOVED", error: "Koru'ya birkoru.com adresinden yeniden giriş yap." }, { status: 409 }));
  }
  const strict = readingGroupsEnabled() && env.APPLICATION_BRAND === "Koru";
  const nonce = strict && process.env.NODE_ENV !== "development"
    ? btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))) : undefined;
  const forwarded = new Headers(request.headers);
  forwarded.delete("x-koru-nonce");
  if (nonce) forwarded.set("x-koru-nonce", nonce);
  forwarded.set("Content-Security-Policy", browserSecurityHeaders(selfServiceEnabled(), strict ? nonce : undefined, process.env.NODE_ENV === "development")["Content-Security-Policy"]);
  const next = () => NextResponse.next({ request: { headers: forwarded } });
  const enforceLocalBrowserRequests = <T extends Response>(response: T) => enforceSecurity(response, nonce);
  const { pathname } = request.nextUrl;
  // This route authenticates a separate operator Secret, never a group role.
  if (pathname === "/api/operations/erasure") return enforceLocalBrowserRequests(next());
  if (env.MAINTENANCE_MODE === "true" && !publicShell.has(pathname) && !(!pathname.startsWith("/api/") && publicAsset.test(pathname))) {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ code: "MAINTENANCE", error: "Koru kısa süreli bakımda. Biraz sonra yeniden dene." }, { status: 503 })
      : new NextResponse("Koru kısa süreli bakımda. Biraz sonra yeniden dene. Destek: koru.destek@gmail.com", { status: 503 });
    response.headers.set("Retry-After", "60");
    return enforceLocalBrowserRequests(response);
  }
  if (firebaseSelected(env) && !firebaseConfiguration(env, request.url)) {
    return enforceLocalBrowserRequests(NextResponse.json({ error: "Kimlik doğrulama ortamı kullanılamıyor." }, { status: 503 }));
  }
  if (firebaseLocalSelected(env) && !firebaseLocalConfiguration(env, request.url)) {
    return enforceLocalBrowserRequests(NextResponse.json({ error: "Yerel kimlik doğrulama ortamı kullanılamıyor." }, { status: 503 }));
  }
  if (pathname === "/api/onboarding/config") return enforceLocalBrowserRequests(next());
  if (onboardingPublicPaths.has(pathname)) {
    return enforceLocalBrowserRequests(selfServiceEnabled() ? next() : new NextResponse("Sayfa bulunamadı.", { status: 404 }));
  }
  if (publicShell.has(pathname) || (!pathname.startsWith("/api/") && publicAsset.test(pathname))) return enforceLocalBrowserRequests(next());
  if (publicPaths.has(pathname) && pathname !== "/login") return enforceLocalBrowserRequests(next());

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  let identity;
  let authenticated = false;
  try {
    identity = await sessionIdentity(session);
    authenticated = !!identity && await sessionAccountIsCurrent(identity);
  } catch (error) {
    console.error("Could not validate session account");
    if (firebaseLocalSelected(env) || firebaseSelected(env)) return enforceLocalBrowserRequests(readingGroupErrorResponse(error));
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
        : next(),
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

  return enforceLocalBrowserRequests(next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
import { env } from "cloudflare:workers";
