import { NextResponse, type NextRequest } from "next/server";
import { sessionAccountIsCurrent } from "@/db/accounts";
import {
  authIsConfigured,
  SESSION_COOKIE,
  sessionIdentity,
} from "@/lib/auth";

const publicPaths = new Set(["/login", "/design-lab", "/api/auth/login", "/api/auth/logout"]);
const publicAsset = /\.(?:css|js|map|svg|png|jpg|jpeg|webp|ico|woff2?)$/i;

function enforceLocalBrowserRequests(response: NextResponse) {
  response.headers.set("Content-Security-Policy", "connect-src 'self'");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (publicAsset.test(pathname)) return NextResponse.next();
  if (publicPaths.has(pathname) && pathname !== "/login") return NextResponse.next();

  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const identity = await sessionIdentity(session);
  let authenticated = false;
  try {
    authenticated = !!identity && await sessionAccountIsCurrent(identity);
  } catch (error) {
    console.error("Could not validate session account", error);
  }

  if (pathname === "/login") {
    return enforceLocalBrowserRequests(
      authenticated
        ? NextResponse.redirect(new URL("/", request.url))
        : NextResponse.next(),
    );
  }

  if (!authIsConfigured() || !authenticated) {
    if (pathname.startsWith("/api/")) {
      return enforceLocalBrowserRequests(
        NextResponse.json({ error: "Oturum gerekli." }, { status: 401 }),
      );
    }
    return enforceLocalBrowserRequests(
      NextResponse.redirect(new URL("/login", request.url)),
    );
  }

  return enforceLocalBrowserRequests(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
