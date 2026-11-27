import "server-only";

import { apiException, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import type { AppResult } from "@/lib/insforge/errors";
import {
  completeSupabasePasswordReset,
  exchangeSupabasePasswordResetCode,
  requestSupabasePasswordReset,
} from "./password-reset-service";
import { createSupabasePasswordResetRepository } from "./password-reset-repository";

async function run(
  operation: string,
  request: Request,
  handler: (
    body: Record<string, unknown> | null,
    repository: ReturnType<typeof createSupabasePasswordResetRepository>,
  ) => Promise<AppResult<unknown>>,
) {
  const timer = createApiTimer(operation);
  try {
    const body = await timer.measure("validation", () =>
      request.json().catch(() => null) as Promise<Record<string, unknown> | null>,
    );
    const repository = createSupabasePasswordResetRepository();
    const result = await timer.measure("service", () => handler(body, repository));
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);
    return apiResult(result, meta);
  } catch (error) {
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);
    return apiException(error, meta);
  }
}

export const supabasePasswordResetHandlers = {
  REQUEST(request: Request) {
    return run("auth.password-reset.request", request, (body, repository) =>
      requestSupabasePasswordReset({ repository, email: body?.email }),
    );
  },
  EXCHANGE(request: Request) {
    return run("auth.password-reset.exchange", request, (body, repository) =>
      exchangeSupabasePasswordResetCode({ repository, email: body?.email, code: body?.code }),
    );
  },
  COMPLETE(request: Request) {
    return run("auth.password-reset.complete", request, (body, repository) =>
      completeSupabasePasswordReset({
        repository, email: body?.email, token: body?.token, newPassword: body?.newPassword,
      }),
    );
  },
};
