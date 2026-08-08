import type { AppBackendError } from "@/lib/insforge/errors";

export type ApiErrorKind =
  | "unauthorized"
  | "forbidden"
  | "validation"
  | "not_found"
  | "conflict"
  | "internal";

export type ApiError = {
  kind: ApiErrorKind;
  code: string;
  message: string;
  status: number;
  details?: unknown;
  nextActions?: string;
};

export function unauthorizedApiError(
  message = "Authentication required",
): ApiError {
  return {
    kind: "unauthorized",
    code: "AUTH_REQUIRED",
    message,
    status: 401,
  };
}

export function forbiddenApiError(message = "Permission denied"): ApiError {
  return {
    kind: "forbidden",
    code: "FORBIDDEN",
    message,
    status: 403,
  };
}

export function validationApiError({
  message,
  code = "VALIDATION_ERROR",
  details,
}: {
  message: string;
  code?: string;
  details?: unknown;
}): ApiError {
  return {
    kind: "validation",
    code,
    message,
    status: 400,
    details,
  };
}

export function internalApiError(
  message = "Unexpected API error",
): ApiError {
  return {
    kind: "internal",
    code: "INTERNAL_ERROR",
    message,
    status: 500,
  };
}

export function apiErrorFromAppBackendError(error: AppBackendError): ApiError {
  const status = error.statusCode ?? 500;

  return {
    kind: apiErrorKindFromStatus(status),
    code: error.code,
    message: error.message,
    status,
    nextActions: error.nextActions,
  };
}

export function apiErrorFromUnknown(error: unknown): ApiError {
  if (isApiError(error)) {
    return error;
  }

  if (error instanceof Error) {
    return {
      ...internalApiError(error.message),
      code: error.name || "INTERNAL_ERROR",
    };
  }

  return internalApiError();
}

function apiErrorKindFromStatus(status: number): ApiErrorKind {
  if (status === 401) {
    return "unauthorized";
  }

  if (status === 403) {
    return "forbidden";
  }

  if (status === 404) {
    return "not_found";
  }

  if (status === 409) {
    return "conflict";
  }

  if (status >= 400 && status < 500) {
    return "validation";
  }

  return "internal";
}

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "kind" in error &&
    "code" in error &&
    "message" in error &&
    "status" in error
  );
}
