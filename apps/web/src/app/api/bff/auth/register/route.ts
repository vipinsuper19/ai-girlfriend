import { NextRequest, NextResponse } from "next/server";

import { setAuthCookies } from "@/lib/server/cookies";
import { nestRequest, parseEnvelope } from "@/lib/server/nest";
import type { AuthTokens } from "@/types/api";

function allowedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  if (!allowedOrigin(request)) {
    return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
  }

  const body = (await request.json()) as {
    email?: string;
    password?: string;
    displayName?: string;
  };

  const upstream = await nestRequest("/auth/register", {
    method: "POST",
    body: JSON.stringify({
      email: body.email?.trim().toLowerCase() ?? "",
      password: body.password ?? "",
      displayName: body.displayName?.trim() ?? "",
    }),
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
