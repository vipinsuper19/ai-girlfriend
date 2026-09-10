import { cookies } from "next/headers";

import { ApiError } from "@/lib/api-error";
import { errorMessage } from "@/lib/utils";
import { ACCESS_COOKIE } from "@/lib/server/cookies";
import { nestRequest, parseEnvelope } from "@/lib/server/nest";

export async function serverApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value ?? null;

  const response = await nestRequest(path, {
    ...init,
    accessToken,
  });

  try {
    return await parseEnvelope<T>(response);
  } catch (error) {
    const err = error as Error & { status?: number; body?: unknown };
    throw new ApiError(
      err.status ?? 500,
      err.body,
      errorMessage(err.body, err.message),
    );
  }
}
