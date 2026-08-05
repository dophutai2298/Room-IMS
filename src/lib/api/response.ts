import type { AppResult } from "@/lib/insforge/errors";
import {
  apiErrorFromAppBackendError,
  apiErrorFromUnknown,
  type ApiError,
} from "./errors";
import type { ApiTimingSnapshot } from "./timing";

export type ApiResponseMeta = {
  timing?: ApiTimingSnapshot;
};

export type ApiSuccessResponse<T> = {
  ok: true;
  data: T;
  meta?: ApiResponseMeta;
};

export type ApiErrorResponse = {
  ok: false;
  error: ApiError;
  meta?: ApiResponseMeta;
};

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function apiSuccess<T>(
  data: T,
  meta?: ApiResponseMeta,
): Response {
  return Response.json({
    ok: true,
    data,
    ...(meta ? { meta } : {}),
  } satisfies ApiSuccessResponse<T>);
}

export function apiFailure(
  error: ApiError,
  meta?: ApiResponseMeta,
): Response {
  return Response.json(
    {
      ok: false,
      error,
      ...(meta ? { meta } : {}),
    } satisfies ApiErrorResponse,
    { status: error.status },
  );
}

export function apiResult<T>(
  result: AppResult<T>,
  meta?: ApiResponseMeta,
): Response {
  if (result.error) {
    return apiFailure(apiErrorFromAppBackendError(result.error), meta);
  }

  return apiSuccess(result.data, meta);
}

export function apiException(
  error: unknown,
  meta?: ApiResponseMeta,
): Response {
  return apiFailure(apiErrorFromUnknown(error), meta);
}
