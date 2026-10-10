import { NextRequest, NextResponse } from "next/server";

import {
  clearAuthCookies,
  REFRESH_COOKIE,
  setAuthCookies,
} from "@/lib/server/cookies";
import { nestRequest, parseEnvelope } from "@/lib/server/nest";
import { safeAppPath } from "@/lib/utils";
import type { AuthTokens } from "@/types/api";

async function readRefreshedTokens(
  refreshToken: string,
): Promise<AuthTokens> {
  const upstream = await nestRequest("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  return parseEnvelope<AuthTokens>(upstream);
}

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json(
      { success: false, message: "No refresh token" },
      { status: 401 },
    );
  }

  try {
    const data = await readRefreshedTokens(refreshToken);
    const response = NextResponse.json({ ok: true, user: data.user });
    setAuthCookies(response, data.accessToken, data.refreshToken);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const err = error as Error & { status?: number; body?: unknown };
    const response = NextResponse.json(
      err.body ?? { success: false, message: err.message },
      { status: err.status ?? 401 },
    );
    clearAuthCookies(response);
    return response;
  }
}

export async function GET(request: NextRequest) {
  const next = safeAppPath(request.nextUrl.searchParams.get("next"));
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const loginUrl = new URL("/login", request.url);
  if (next !== "/home") loginUrl.searchParams.set("next", next);

  if (!refreshToken) {
    const response = NextResponse.redirect(loginUrl);
    clearAuthCookies(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }

  try {
    const data = await readRefreshedTokens(refreshToken);
    const response = NextResponse.redirect(new URL(next, request.url));
    setAuthCookies(response, data.accessToken, data.refreshToken);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch {
    const response = NextResponse.redirect(loginUrl);
    clearAuthCookies(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  }
}
