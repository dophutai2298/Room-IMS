import "server-only";

import { getCurrentAppUser } from "@/lib/insforge/rental-repository";
import type { AppUser } from "@/lib/insforge/types";
import { apiErrorFromAppBackendError, unauthorizedApiError, type ApiError } from "@/lib/api/errors";
import type { ApiTimer } from "@/lib/api/timing";

export type OperationalAuthResult =
  | { user: AppUser; error: null }
  | { user: null; error: ApiError };

export async function resolveOperationalAppUser({
  timer,
}: {
  timer?: ApiTimer;
} = {}): Promise<OperationalAuthResult> {
  const result = timer
    ? await timer.measure("auth", () => getCurrentAppUser())
    : await getCurrentAppUser();

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
