import "server-only";

import { apiException, apiResult } from "@/lib/api/response";
import {
  createApiTimer,
  logApiTiming,
  type ApiTimer,
  type ApiTimingSnapshot,
} from "@/lib/api/timing";
import type { AppResult } from "@/lib/insforge/errors";
import type { PasswordResetRepository } from "./password-reset-repository";
import {
  completePasswordResetForOperations,
  exchangePasswordResetCodeForOperations,
  requestPasswordResetForOperations,
} from "./password-reset-service";

type PasswordResetHttpDependencies = {
  createRepository(input: { timer: ApiTimer }): PasswordResetRepository;
  logTiming?: (snapshot: ApiTimingSnapshot) => void;
  now?: () => Date;
};

export function createPasswordResetHttpHandlers({
  createRepository,
  logTiming = logApiTiming,
  now = () => new Date(),
}: PasswordResetHttpDependencies) {
  return {
    REQUEST: createPasswordResetPostHandler(
      "auth.password-reset.request",
      async ({ request, repository, timer }) => {
        const body = await timer.measure("validation", () => readJsonBody(request));
        const redirectTo = `${new URL(request.url).origin}/sign-in`;

        return timer.measure("service", () =>
          requestPasswordResetForOperations({
            repository,
            email: body?.email,
            now: now(),
            redirectTo,
          }),
        );
      },
      { createRepository, logTiming },
    ),
    EXCHANGE: createPasswordResetPostHandler(
      "auth.password-reset.exchange",
      async ({ request, repository, timer }) => {
        const body = await timer.measure("validation", () => readJsonBody(request));

        return timer.measure("service", () =>
          exchangePasswordResetCodeForOperations({
            repository,
            email: body?.email,
            code: body?.code,
            now: now(),
          }),
        );
      },
      { createRepository, logTiming },
    ),
    COMPLETE: createPasswordResetPostHandler(
      "auth.password-reset.complete",
      async ({ request, repository, timer }) => {
        const body = await timer.measure("validation", () => readJsonBody(request));

        return timer.measure("service", () =>
          completePasswordResetForOperations({
            repository,
            email: body?.email,
            token: body?.token,
            newPassword: body?.newPassword,
            now: now(),
          }),
        );
      },
      { createRepository, logTiming },
    ),
  };
}

function createPasswordResetPostHandler<TData>(
  operation: string,
  handler: (input: {
    request: Request;
    repository: PasswordResetRepository;
    timer: ApiTimer;
  }) => Promise<AppResult<TData>>,
  {
    createRepository,
    logTiming,
  }: Required<Pick<PasswordResetHttpDependencies, "createRepository" | "logTiming">>,
) {
  return async (request: Request) => {
    const timer = createApiTimer(operation);

    try {
      const repository = createRepository({ timer });
      const result = await handler({ request, repository, timer });
      const meta = { timing: timer.snapshot() };
      logTiming(meta.timing);

      return apiResult(result, meta);
    } catch (error) {
      const meta = { timing: timer.snapshot() };
      logTiming(meta.timing);

      return apiException(error, meta);
    }
  };
}

async function readJsonBody(request: Request) {
  return (await request.json().catch(() => null)) as Record<string, unknown> | null;
}
