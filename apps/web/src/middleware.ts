import { jwtVerify } from "jose";
import { NextResponse, type NextRequest } from "next/server";

import { ACCESS_COOKIE, SESSION_COOKIE } from "@/lib/server/cookies";
import { safeAppPath, safeNextPath } from "@/lib/utils";

const PUBLIC_PREFIXES = [
  "/",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

const AUTH_ONLY = ["/login", "/signup", "/forgot-password", "/reset-password"];
const REFRESH_PATH = "/api/bff/auth/refresh";

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

  const hasSession = Boolean(session);
  const isRefresh = pathname === REFRESH_PATH;

  if (
    !accessValid &&
    hasSession &&
    !isRefresh &&
    request.method === "GET" &&
    (!isPublic(pathname) || AUTH_ONLY.includes(pathname))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = REFRESH_PATH;
    const next = AUTH_ONLY.includes(pathname)
      ? safeAppPath(request.nextUrl.searchParams.get("next"))
      : safeAppPath(`${pathname}${search}`);
    url.search = "";
    url.searchParams.set("next", next);
    return NextResponse.redirect(url);
  }

  if (!accessValid && !hasSession && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }

  if (accessValid && AUTH_ONLY.includes(pathname)) {
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
