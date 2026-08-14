import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { getCurrentAppUserForOperations } from "@/lib/auth/service";
import { createInsForgeAuthRepository } from "@/lib/insforge/auth-repository";
import type { AppResult } from "@/lib/insforge/errors";
import type { AppUser } from "@/lib/insforge/types";
import {
  resolveOperationalAppUserResult,
  type OperationalAuthResult,
} from "./operational-auth-core";

export type { OperationalAuthResult } from "./operational-auth-core";

export async function resolveOperationalAppUser({
  timer,
  getCurrentUser,
}: {
  timer?: ApiTimer;
  getCurrentUser?: () => Promise<AppResult<AppUser | null>>;
} = {}): Promise<OperationalAuthResult> {
  const resolveCurrentUser =
    getCurrentUser ??
    (() =>
      getCurrentAppUserForOperations({
        repository: createInsForgeAuthRepository({ timer }),
        timer,
      }));

  return resolveOperationalAppUserResult({
    timer,
    getCurrentUser: resolveCurrentUser,
  });
}
