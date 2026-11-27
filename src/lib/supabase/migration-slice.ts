/** Fail closed for endpoints whose repository has not migrated yet. */
export function isSupabaseFoundationApiPath(pathname: string): boolean {
  return /^\/api\/auth\/(sign-in|sign-out|refresh|password-reset\/(request|exchange|complete))$/.test(pathname)
    || pathname === "/api/foundation/current-user"
    || pathname === "/api/rooms"
    || /^\/api\/rooms\/[^/]+(?:\/detail)?$/.test(pathname)
    || pathname === "/api/staff"
    || /^\/api\/staff\/[^/]+$/.test(pathname);
}

export function isSupabaseFoundationPagePath(pathname: string): boolean {
  return pathname === "/sign-in"
    || pathname === "/rooms"
    || /^\/rooms\/[^/]+$/.test(pathname)
    || pathname === "/staff";
}
