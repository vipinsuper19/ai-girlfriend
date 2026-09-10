import { ApiError } from "@/lib/api-error";
import { errorMessage } from "@/lib/utils";

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
};

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = fetch("/api/bff/auth/refresh", {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const execute = async (): Promise<Response> => {
    const headers = new Headers(options.headers);
    const isForm = typeof FormData !== "undefined" && options.body instanceof FormData;

    if (options.body !== undefined && !isForm && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(`/api/bff${path}`, {
      ...options,
      headers,
      credentials: "include",
      body:
        options.body === undefined
          ? undefined
          : isForm
            ? (options.body as FormData)
            : JSON.stringify(options.body),
    });
  };

  let response = await execute();

  if (response.status === 401 && !path.startsWith("/auth/")) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      response = await execute();
    }
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    throw new ApiError(
      response.status,
      parsed,
      errorMessage(parsed, response.statusText),
    );
  }

  if (parsed && typeof parsed === "object" && "data" in parsed && "success" in parsed) {
    return (parsed as { data: T }).data;
  }

  return parsed as T;
}
