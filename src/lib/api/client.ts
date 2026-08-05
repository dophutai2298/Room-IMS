import type { ApiError, ApiErrorKind } from "./errors";
import type { ApiResponse } from "./response";

export class AppApiClientError extends Error {
  kind: ApiErrorKind;
  code: string;
  status: number;
  details?: unknown;
  nextActions?: string;

  constructor(error: ApiError) {
    super(error.message);
    this.name = "AppApiClientError";
    this.kind = error.kind;
    this.code = error.code;
    this.status = error.status;
    this.details = error.details;
    this.nextActions = error.nextActions;
  }
}

export async function fetchAppApi<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  const payload = (await response.json().catch(() => null)) as ApiResponse<T> | null;

  if (!payload || typeof payload !== "object" || !("ok" in payload)) {
    throw new AppApiClientError({
      kind: "internal",
      code: "INVALID_API_RESPONSE",
      message: "API returned an invalid response shape.",
      status: response.status || 500,
    });
  }

  if (!payload.ok) {
    throw new AppApiClientError(payload.error);
  }

  return payload.data;
}
