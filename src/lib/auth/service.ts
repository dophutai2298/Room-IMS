import "server-only";

import type { AppResult } from "@/lib/insforge/errors";
import type { AppUser } from "@/lib/insforge/types";
import type { AuthRepository } from "./repository";

export function getCurrentAppUserForOperations({
  repository,
}: {
  repository: AuthRepository;
}): Promise<AppResult<AppUser | null>> {
  return repository.getCurrentAppUser();
}
