import "server-only";

import type { ApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import {
  createApiTimer,
  logApiTiming,
  type ApiTimer,
  type ApiTimingSnapshot,
} from "@/lib/api/timing";
import type { AppResult } from "@/lib/insforge/errors";
import type { AppRole, AppUser } from "@/lib/insforge/types";
import {
  requireOperationalRole,
  type OperationalAuthResult,
} from "./operational-auth-core";

export type AuthenticatedRouteContext = {
  timer: ApiTimer;
  user: AppUser;
};

type OperationalRouteResult<T> = AppResult<T> | ApiError | Response;

type OperationalRouteOptions = {
  operation: string;
  allowedRoles?: readonly AppRole[];
  forbiddenMessage?: string;
  resolveAuth?: (input: { timer: ApiTimer }) => Promise<OperationalAuthResult>;
  logTiming?: (snapshot: ApiTimingSnapshot) => void;
};

export function withOperationalAuth<TArgs extends unknown[], TData>(
  {
    operation,
    allowedRoles,
    forbiddenMessage,
    resolveAuth = resolveDefaultOperationalAuth,
    logTiming = logApiTiming,
  }: OperationalRouteOptions,
  handler: (
    context: AuthenticatedRouteContext,
    ...args: TArgs
  ) => Promise<OperationalRouteResult<TData>> | OperationalRouteResult<TData>,
) {
  return async (...args: TArgs): Promise<Response> => {
    const timer = createApiTimer(operation);

    try {
      const auth = await resolveAuth({ timer });

      if (auth.error) {
        return finishFailure(auth.error, timer, logTiming);
      }

      if (allowedRoles) {
        const roleError = requireOperationalRole(auth.user, allowedRoles);

        if (roleError) {
          return finishFailure(
            forbiddenMessage ? { ...roleError, message: forbiddenMessage } : roleError,
            timer,
            logTiming,
          );
        }
      }

      return finishResult(
        await handler({ timer, user: auth.user }, ...args),
        timer,
        logTiming,
      );
    } catch (error) {
      return finishException(error, timer, logTiming);
    }
  };
}

async function resolveDefaultOperationalAuth(input: {
  timer: ApiTimer;
}): Promise<OperationalAuthResult> {
  const { resolveOperationalAppUser } = await import("./operational-auth");

  return resolveOperationalAppUser(input);
}

function finishResult<T>(
  result: OperationalRouteResult<T>,
  timer: ApiTimer,
  logTiming: (snapshot: ApiTimingSnapshot) => void,
) {
  const meta = { timing: timer.snapshot() };
  logTiming(meta.timing);

  if (result instanceof Response) {
    return result;
  }

  if (isApiError(result)) {
    return apiFailure(result, meta);
  }

  return apiResult(result, meta);
}

function finishFailure(
  error: ApiError,
  timer: ApiTimer,
  logTiming: (snapshot: ApiTimingSnapshot) => void,
) {
  const meta = { timing: timer.snapshot() };
  logTiming(meta.timing);

  return apiFailure(error, meta);
}

function finishException(
  error: unknown,
  timer: ApiTimer,
  logTiming: (snapshot: ApiTimingSnapshot) => void,
) {
  const meta = { timing: timer.snapshot() };
  logTiming(meta.timing);

  return apiException(error, meta);
}

function isApiError(result: unknown): result is ApiError {
  return (
    typeof result === "object" &&
    result !== null &&
    "kind" in result &&
    "code" in result &&
    "message" in result &&
    "status" in result
  );
}
