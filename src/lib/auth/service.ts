import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import type { AppResult } from "@/lib/insforge/errors";
import type { AppUser } from "@/lib/insforge/types";
import { getActiveOperationalAppUser } from "@/lib/server/operational-auth-context";
import type { AuthRepository } from "./repository";

export function getCurrentAppUserForOperations({
  repository,
  timer,
}: {
  repository: AuthRepository;
  timer?: ApiTimer;
}): Promise<AppResult<AppUser | null>> {
  const activeUser = getActiveOperationalAppUser();

  if (activeUser) {
    timer?.recordSpan("auth.cached-app-user", 0, {
      source: "route-context",
      role: activeUser.role,
    });

    return Promise.resolve({ data: activeUser, error: null });
  }

  return repository.getCurrentAppUser();
}
