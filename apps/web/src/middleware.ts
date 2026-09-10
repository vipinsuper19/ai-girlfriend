import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIE, SESSION_COOKIE } from "@/lib/server/cookies";
import { safeNextPath } from "@/lib/utils";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

const AUTH_ONLY = ["/login", "/signup", "/forgot-password", "/reset-password"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_PREFIXES.includes(pathname)) return true;
  if (pathname.startsWith("/api/bff")) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico") return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const session = request.cookies.get(SESSION_COOKIE)?.value;

  let accessValid = false;
  if (access && process.env.JWT_ACCESS_SECRET) {
    try {
      await jwtVerify(
        access,
        new TextEncoder().encode(process.env.JWT_ACCESS_SECRET),
      );
      accessValid = true;
    } catch {
      accessValid = false;
    }
  } else if (access) {
    accessValid = true;
  }

  const signedIn = accessValid || Boolean(session);

  if (!signedIn && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (signedIn && AUTH_ONLY.includes(pathname)) {
    const next = safeNextPath(request.nextUrl.searchParams.get("next"));
    const url = request.nextUrl.clone();
    url.pathname = next ?? "/home";
    url.search = next ? "" : "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|uploads|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
