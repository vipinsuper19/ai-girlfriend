import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "@/lib/server/cookies";
import { nestRequest, parseEnvelope } from "@/lib/server/nest";
import type { AuthTokens } from "@/types/api";

function allowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  try {
    const url = new URL(origin);
    return url.host === host;
  } catch {
    return false;
  }
}

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { success: false, statusCode: status, message },
    { status },
  );
}

export async function POST(request: NextRequest) {
  if (!allowedOrigin(request)) {
    return jsonError("Invalid origin", 403);
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
  };

  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password ?? "";

  const upstream = await nestRequest("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  try {
    const data = await parseEnvelope<AuthTokens>(upstream);
    const response = NextResponse.json({ user: data.user });
    setAuthCookies(response, data.accessToken, data.refreshToken);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const err = error as Error & { status?: number; body?: unknown };
    return NextResponse.json(
      err.body ?? { success: false, message: err.message },
      { status: err.status ?? 500 },
    );
  }
}
