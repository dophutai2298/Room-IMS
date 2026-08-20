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
  const isFormDataBody = init?.body instanceof FormData;
  const response = await fetch(input, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body && !isFormDataBody ? { "Content-Type": "application/json" } : {}),
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
    redirectExpiredSession(payload.error);
    throw new AppApiClientError(payload.error);
  }

  return payload.data;
}

export async function fetchAppFile(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, init);

  if (response.ok) {
    return response;
  }

  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<never>
    | null;

  if (payload && typeof payload === "object" && "ok" in payload && !payload.ok) {
    redirectExpiredSession(payload.error);
    throw new AppApiClientError(payload.error);
  }

  throw new AppApiClientError({
    kind: "internal",
    code: "INVALID_FILE_RESPONSE",
    message: "Không thể tải file từ hệ thống.",
    status: response.status || 500,
  });
}

function redirectExpiredSession(error: ApiError) {
  if (
    error.status !== 401 ||
    typeof window === "undefined" ||
    window.location.pathname === "/sign-in"
  ) {
    return;
  }

  const nextPath = `${window.location.pathname}${window.location.search}`;
  window.location.assign(`/sign-in?next=${encodeURIComponent(nextPath)}`);
}
