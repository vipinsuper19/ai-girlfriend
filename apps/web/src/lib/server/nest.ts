import type { ApiEnvelope, ApiErrorBody } from "@/types/api";
import { errorMessage } from "@/lib/utils";

export const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3001";
export const API_BASE = `${API_ORIGIN}/api/v1`;

export async function nestRequest(
  path: string,
  init: RequestInit & { accessToken?: string | null } = {},
): Promise<Response> {
  const { accessToken, headers, ...rest } = init;
  const requestHeaders = new Headers(headers);

  if (accessToken) {
    requestHeaders.set("Authorization", `Bearer ${accessToken}`);
  }

  if (
    rest.body &&
    !(rest.body instanceof FormData) &&
    !requestHeaders.has("Content-Type")
  ) {
    requestHeaders.set("Content-Type", "application/json");
  }

  return fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: requestHeaders,
    cache: "no-store",
  });
}

export async function parseEnvelope<T>(response: Response): Promise<T> {
  const text = await response.text();
  let parsed: ApiEnvelope<T> | ApiErrorBody | T | null = null;

  if (text) {
    try {
      parsed = JSON.parse(text) as ApiEnvelope<T> | ApiErrorBody | T;
    } catch {
      parsed = null;
    }
  }

  if (!response.ok) {
    const body = parsed ?? { message: text || response.statusText };
    const error = new Error(errorMessage(body, response.statusText));
    (error as Error & { status: number; body: unknown }).status = response.status;
    (error as Error & { status: number; body: unknown }).body = body;
    throw error;
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "data" in parsed &&
    "success" in parsed
  ) {
    return (parsed as ApiEnvelope<T>).data;
  }

  return parsed as T;
}
