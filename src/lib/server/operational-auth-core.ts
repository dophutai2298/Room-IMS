import {
  apiErrorFromAppBackendError,
  unauthorizedApiError,
  type ApiError,
} from "@/lib/api/errors";
import type { ApiTimer } from "@/lib/api/timing";
import type { AppResult } from "@/lib/insforge/errors";
import type { AppUser } from "@/lib/insforge/types";

export type OperationalAuthResult =
  | { user: AppUser; error: null }
  | { user: null; error: ApiError };

export async function resolveOperationalAppUserResult({
  timer,
  getCurrentUser,
}: {
  timer?: ApiTimer;
  getCurrentUser: () => Promise<AppResult<AppUser | null>>;
}): Promise<OperationalAuthResult> {
  const result = timer
    ? await timer.measure("auth", () => getCurrentUser())
    : await getCurrentUser();

  if (result.error) {
    return {
      user: null,
      error: apiErrorFromAppBackendError(result.error),
    };
  }

  if (!result.data) {
    return {
      user: null,
      error: unauthorizedApiError(),
    };
  }

  return {
    user: result.data,
    error: null,
  };
}
