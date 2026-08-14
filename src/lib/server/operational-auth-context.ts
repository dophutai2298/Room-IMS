import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import type { AppUser } from "@/lib/insforge/types";

const operationalAppUserStorage = new AsyncLocalStorage<AppUser>();

export function runWithOperationalAppUser<T>(
  user: AppUser,
  work: () => Promise<T>,
): Promise<T> {
  return operationalAppUserStorage.run(user, work);
}

export function getActiveOperationalAppUser(): AppUser | undefined {
  return operationalAppUserStorage.getStore();
}
