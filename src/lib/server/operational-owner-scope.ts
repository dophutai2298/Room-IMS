import "server-only";

import type { AppUser } from "@/lib/insforge/types";
import { getActiveOperationalAppUser } from "./operational-auth-context";

export function resolveOwnerAppUserId(user: AppUser) {
  return user.ownerAppUserId ?? user.id;
}

export function getActiveOwnerAppUserId() {
  const user = getActiveOperationalAppUser();

  if (!user) {
    throw new Error("Operational owner scope is unavailable outside an authenticated route.");
  }

  return resolveOwnerAppUserId(user);
}
