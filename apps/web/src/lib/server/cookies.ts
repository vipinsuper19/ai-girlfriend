import type { NextResponse } from "next/server";

export const ACCESS_COOKIE = "ag_at";
export const REFRESH_COOKIE = "ag_rt";
export const SESSION_COOKIE = "ag_session";

const THIRTY_DAYS = 60 * 60 * 24 * 30;

function isProd() {
  return process.env.NODE_ENV === "production";
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string,
) {
  const accessMaxAge = tokenMaxAge(accessToken) ?? 60 * 15;

  response.cookies.set(ACCESS_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: accessMaxAge,
  });

  response.cookies.set(REFRESH_COOKIE, refreshToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "strict",
    path: "/api/bff/auth",
    maxAge: THIRTY_DAYS,
  });

  // Presence flag only — refresh is path-scoped and would be invisible to middleware.
  response.cookies.set(SESSION_COOKIE, "1", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: THIRTY_DAYS,
  });
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE, "", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  response.cookies.set(REFRESH_COOKIE, "", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "strict",
    path: "/api/bff/auth",
    maxAge: 0,
  });
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isProd(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export function tokenMaxAge(token: string): number | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    ) as { exp?: number };
    if (!json.exp) return null;
    return Math.max(0, json.exp - Math.floor(Date.now() / 1000));
  } catch {
    return null;
  }
}
