/** Fail closed for endpoints whose repository has not migrated yet. */
export function isSupabaseFoundationApiPath(pathname: string): boolean {
  return /^\/api\/auth\/(sign-in|sign-out|refresh|password-reset\/(request|exchange|complete))$/.test(pathname)
    || pathname === "/api/foundation/current-user"
    || pathname === "/api/rooms"
    || /^\/api\/rooms\/[^/]+(?:\/detail)?$/.test(pathname)
    || pathname === "/api/staff"
    || /^\/api\/staff\/[^/]+$/.test(pathname)
    || pathname === "/api/tenants"
    || /^\/api\/tenants\/[^/]+(?:\/cccd-images(?:\/[^/]+(?:\/content)?)?)?$/.test(pathname)
    || /^\/api\/rooms\/[^/]+\/(?:tenants|contracts)$/.test(pathname)
    || /^\/api\/contracts\/[^/]+$/.test(pathname)
    || /^\/api\/rooms\/[^/]+\/(?:utility-metrics|invoices(?:\/pdf)?)$/.test(pathname)
    || /^\/api\/rooms\/[^/]+\/operations-summary$/.test(pathname)
    || pathname === "/api/utility-pricing"
    || /^\/api\/utility-pricing\/[^/]+$/.test(pathname)
    || pathname === "/api/invoices"
    || /^\/api\/invoices\/[^/]+\/payment$/.test(pathname);
}

export function isSupabaseFoundationPagePath(pathname: string): boolean {
  return pathname === "/sign-in"
    || pathname === "/rooms"
    || /^\/rooms\/[^/]+$/.test(pathname)
    || pathname === "/staff"
    || pathname === "/tenants"
    || pathname === "/invoices"
    || pathname === "/utility-pricing"
    || /^\/rooms\/[^/]+\/utilities$/.test(pathname);
}
