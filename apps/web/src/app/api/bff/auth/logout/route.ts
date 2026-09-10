import { NextRequest, NextResponse } from "next/server";

import {
  ACCESS_COOKIE,
  clearAuthCookies,
} from "@/lib/server/cookies";
import { nestRequest } from "@/lib/server/nest";

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

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  if (accessToken) {
    await nestRequest("/auth/logout", {
      method: "POST",
      accessToken,
    }).catch(() => undefined);
  }

  const response = NextResponse.json({ ok: true });
  clearAuthCookies(response);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
