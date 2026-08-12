import "server-only";

import { getCurrentAppUser } from "@/lib/insforge/rental-repository";
import type { ApiTimer } from "@/lib/api/timing";
import {
  resolveOperationalAppUserResult,
  type OperationalAuthResult,
} from "./operational-auth-core";

export type { OperationalAuthResult } from "./operational-auth-core";

export async function resolveOperationalAppUser({
  timer,
  getCurrentUser = getCurrentAppUser,
}: {
  timer?: ApiTimer;
  getCurrentUser?: typeof getCurrentAppUser;
} = {}): Promise<OperationalAuthResult> {
  return resolveOperationalAppUserResult({ timer, getCurrentUser });
}
