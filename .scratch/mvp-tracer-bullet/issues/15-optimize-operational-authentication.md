# 15 - Optimize Operational Authentication

**What to build:** Authenticated operational API requests avoid unnecessary repeated identity resolution while preserving Landlord and Staff authorization behavior. The user should see faster protected API responses, and developers should still get clear Auth timing when a request succeeds or fails.

**Blocked by:** 14 - Add API Tracing and Performance Baseline.

**Status:** implemented; live baseline pending.

- [x] The authenticated Landlord or Staff user is resolved once per incoming operational API request and handed to the handler through the common route boundary.
- [x] Downstream service and repository work no longer performs duplicate current-user or app-user role lookups when the route boundary has already resolved the authenticated app user.
- [x] Auth timing distinguishes session resolution from app-user role/profile lookup while keeping the existing total Auth span for compatibility.
- [x] Authorization failures still short-circuit the protected handler and return the existing error shape.
- [x] Server actions that still access InsForge outside the common API route wrapper are reviewed and either aligned with the shared Auth timing vocabulary or explicitly documented as exceptions.
- [x] Tests cover successful Landlord/Staff resolution, missing auth, missing app-user mapping, role failures, and the "resolved once per request" behavior.
- [ ] Before/after baseline data shows the Auth span and total API latency changed for representative endpoints.

## Implementation Notes

- Added request-scoped operational Auth context at `src/lib/server/operational-auth-context.ts`.
- `withOperationalAuth()` resolves the Landlord or Staff app user once, then runs the protected handler inside that Auth context.
- `getCurrentAppUserForOperations()` now returns the active request user when available instead of calling the repository again. This avoids duplicate current-session and `app_users` lookups inside one operational API request.
- Cached request-user reuse records a lightweight `auth.cached-app-user` timing span with safe attributes: `source=route-context` and `role`.
- Existing Auth timing compatibility is preserved: the boundary resolution still records the parent `auth` span, and ticket 14 already split the remote Auth work into `auth.session` and `auth.app-user.lookup`.
- Authorization failures still occur before the protected handler runs, preserving the existing API error shape.

## Server Action Review

- `src/app/rooms/[id]/utilities/actions.ts` still calls the legacy Invoice-generation path outside `withOperationalAuth()`.
- That path is documented as an exception for this ticket because it is a Server Action rather than an operational API route. It should be measured or migrated separately if Invoice generation remains a performance bottleneck.

## Verification

- `node --conditions=react-server --import tsx --test src/lib/server/operational-route.behavior.test.ts`
- `npx.cmd tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd test`

## Live Baseline Command

Run after starting the dev server and copying an authenticated browser Cookie header:

```powershell
$env:API_BASELINE_COOKIE = "<copy browser Cookie header>"
npm.cmd run perf:api-baseline
```
