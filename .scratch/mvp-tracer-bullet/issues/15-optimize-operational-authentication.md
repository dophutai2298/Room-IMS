# 15 - Optimize Operational Authentication

**What to build:** Authenticated operational API requests avoid unnecessary repeated identity resolution while preserving Landlord and Staff authorization behavior. The user should see faster protected API responses, and developers should still get clear Auth timing when a request succeeds or fails.

**Blocked by:** 14 - Add API Tracing and Performance Baseline.

**Status:** ready-for-agent

- [ ] The authenticated Landlord or Staff user is resolved once per incoming operational API request and handed to the handler through the common route boundary.
- [ ] Downstream service and repository work no longer performs duplicate current-user or app-user role lookups when the route boundary has already resolved the authenticated app user.
- [ ] Auth timing distinguishes session resolution from app-user role/profile lookup while keeping the existing total Auth span for compatibility.
- [ ] Authorization failures still short-circuit the protected handler and return the existing error shape.
- [ ] Server actions that still access InsForge outside the common API route wrapper are reviewed and either aligned with the shared Auth timing vocabulary or explicitly documented as exceptions.
- [ ] Tests cover successful Landlord/Staff resolution, missing auth, missing app-user mapping, role failures, and the "resolved once per request" behavior.
- [ ] Before/after baseline data shows the Auth span and total API latency changed for representative endpoints.
