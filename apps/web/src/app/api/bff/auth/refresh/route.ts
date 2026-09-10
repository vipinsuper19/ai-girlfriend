import { NextRequest, NextResponse } from "next/server";

import { clearAuthCookies, REFRESH_COOKIE, setAuthCookies } from "@/lib/server/cookies";
import { nestRequest, parseEnvelope } from "@/lib/server/nest";
import type { AuthTokens } from "@/types/api";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  if (!refreshToken) {
    return NextResponse.json(
      { success: false, message: "No refresh token" },
      { status: 401 },
    );
  }

  const upstream = await nestRequest("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });

  try {
    const data = await parseEnvelope<AuthTokens>(upstream);
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
