import { AppApiClientError, fetchAppApi } from "@/lib/api/client";
import type { AppUser } from "@/lib/insforge/types";

export function fetchCurrentAppUser() {
  return fetchAppApi<AppUser>("/api/foundation/current-user", {
    cache: "no-store",
  });
}

export async function fetchOptionalCurrentAppUser() {
  try {
    return await fetchCurrentAppUser();
  } catch (error) {
    if (error instanceof AppApiClientError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

export function signOutCurrentSession() {
  return fetchAppApi<{ signedOut: true }>("/api/auth/sign-out", {
    method: "POST",
  });
}
