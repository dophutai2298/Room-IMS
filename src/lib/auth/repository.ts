import type { AppResult } from "@/lib/insforge/errors";
import type { AppUser } from "@/lib/insforge/types";

export type AuthRepository = {
  getCurrentAppUser(): Promise<AppResult<AppUser | null>>;
};
