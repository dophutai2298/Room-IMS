import type { InsForgeError } from "@insforge/sdk";

export type AppBackendError = {
  message: string;
  code: string;
  statusCode?: number;
  nextActions?: string;
};

export type AppResult<T> =
  | { data: T; error: null }
  | { data: null; error: AppBackendError };

export function ok<T>(data: T): AppResult<T> {
  return { data, error: null };
}

export function fail(error: unknown, fallback = "InsForge request failed"): AppResult<never> {
  return { data: null, error: toAppBackendError(error, fallback) };
}

export function appError({
  message,
  code,
  statusCode,
  nextActions,
}: AppBackendError): AppResult<never> {
  return {
    data: null,
    error: {
      message,
      code,
      statusCode,
      nextActions,
    },
  };
}

export function toAppBackendError(
  error: unknown,
  fallback = "InsForge request failed",
): AppBackendError {
  if (isInsForgeError(error)) {
    return {
      message: error.message || fallback,
      code: String(error.error ?? "INSFORGE_ERROR"),
      statusCode: error.statusCode,
      nextActions: error.nextActions,
    };
  }

  if (isPostgrestLikeError(error)) {
    return {
      message: error.message || fallback,
      code: String(error.code ?? "POSTGREST_ERROR"),
      statusCode: readStatusCode(error),
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message || fallback,
      code: "APP_ERROR",
    };
  }

  return {
    message: fallback,
    code: "UNKNOWN_ERROR",
  };
}

function isInsForgeError(error: unknown): error is InsForgeError {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    "statusCode" in error &&
    "error" in error
  );
}

function isPostgrestLikeError(
  error: unknown,
): error is { code?: unknown; message: string; status?: unknown; statusCode?: unknown } {
  return (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string" &&
    ("code" in error || "details" in error || "hint" in error)
  );
}

function readStatusCode(error: { status?: unknown; statusCode?: unknown }) {
  if (typeof error.statusCode === "number") {
    return error.statusCode;
  }

  if (typeof error.status === "number") {
    return error.status;
  }

  return undefined;
}
