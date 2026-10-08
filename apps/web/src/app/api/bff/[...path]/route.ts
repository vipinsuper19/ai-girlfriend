import { NextRequest, NextResponse } from "next/server";

import { ACCESS_COOKIE, REFRESH_COOKIE, setAuthCookies } from "@/lib/server/cookies";
import { API_BASE } from "@/lib/server/nest";
import type { AuthTokens } from "@/types/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

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

async function refreshTokens(refreshToken: string): Promise<AuthTokens | null> {
  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const parsed = (await response.json()) as { data?: AuthTokens } & AuthTokens;
  return parsed.data ?? parsed;
}

async function proxy(request: NextRequest, path: string[]): Promise<NextResponse> {
  if (MUTATING.has(request.method) && !allowedOrigin(request)) {
    return NextResponse.json({ message: "Invalid origin" }, { status: 403 });
  }

  const targetPath = `/${path.join("/")}`;
  const search = request.nextUrl.search;
  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const isStream = targetPath.endsWith("/messages/stream");

  const headers = new Headers();
  const contentType = request.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const execute = (token: string | undefined) => {
    const nextHeaders = new Headers(headers);
    if (token) nextHeaders.set("Authorization", `Bearer ${token}`);
    return fetch(`${API_BASE}${targetPath}${search}`, {
      method: request.method,
      headers: nextHeaders,
      body: body && body.byteLength > 0 ? body : undefined,
      cache: "no-store",
    });
  };

  let upstream = await execute(accessToken);

  if (upstream.status === 401 && refreshToken) {
    const tokens = await refreshTokens(refreshToken);
    if (tokens) {
      upstream = await execute(tokens.accessToken);
      if (isStream && upstream.body) {
        const response = new NextResponse(upstream.body, {
          status: upstream.status,
          headers: streamHeaders(upstream),
        });
        setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
        return response;
      }
      const payload = await upstream.arrayBuffer();
      const response = new NextResponse(payload, {
        status: upstream.status,
        headers: jsonHeaders(upstream),
      });
      setAuthCookies(response, tokens.accessToken, tokens.refreshToken);
      return response;
    }
  }

  if (isStream && upstream.body) {
    return new NextResponse(upstream.body, {
      status: upstream.status,
      headers: streamHeaders(upstream),
    });
  }

  const payload = await upstream.arrayBuffer();
  return new NextResponse(payload, {
    status: upstream.status,
    headers: jsonHeaders(upstream),
  });
}

function streamHeaders(upstream: Response): Headers {
  const headers = new Headers();
  headers.set("Content-Type", "text/event-stream");
  headers.set("Cache-Control", "no-cache, no-transform");
  headers.set("Connection", "keep-alive");
  headers.set("X-Accel-Buffering", "no");
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  return headers;
}

function jsonHeaders(upstream: Response): Headers {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("Content-Type", contentType);
  return headers;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxy(request, path);
}
