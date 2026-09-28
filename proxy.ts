import { NextResponse, type NextRequest } from "next/server";
import { authIsConfigured, SESSION_COOKIE, sessionIsValid } from "@/lib/auth";

const publicPaths = new Set(["/login", "/api/auth/login", "/api/auth/logout"]);
const publicAsset = /\.(?:css|js|map|svg|png|jpg|jpeg|webp|ico|woff2?)$/i;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = request.cookies.get(SESSION_COOKIE)?.value;
  const authenticated = await sessionIsValid(session);

  if (publicPaths.has(pathname) || publicAsset.test(pathname)) {
    if (pathname === "/login" && authenticated) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (!authIsConfigured() || !authenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
