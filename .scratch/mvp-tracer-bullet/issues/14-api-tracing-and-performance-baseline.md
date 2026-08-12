# 14 - Add API Tracing and Performance Baseline

**What to build:** Operational API latency becomes explainable end to end before any optimization is accepted. A developer can run a repeatable baseline for the InsForge-backed management APIs and see the critical path split into Auth, Service, Repository, InsForge request, and database-related work without exposing secrets or tenant personal data.

**Blocked by:** 13 - Investigate and Improve InsForge API Performance.

**Status:** Done

- [x] API timing includes separate spans for Auth session resolution, app-user role/profile lookup, Service work, Repository work, InsForge client initialization, and each remote InsForge operation.
- [x] InsForge operation timing records safe labels for operation category, method, sanitized endpoint category, status, retry attempt/count, and duration.
- [x] Timing output includes a request correlation identifier that links route, service, repository, and InsForge child spans for one API response.
- [x] Timing logs do not include access tokens, cookies, API keys, request bodies, CCCD values, tenant personal data, or raw image/file contents.
- [x] A repeatable baseline covers cold and warm samples for Room list, Room detail, Invoices list, Dashboard summaries, Tenant directory/detail, Contracts, Utility Metrics, Utility Pricing, Staff, and Foundation endpoints.
- [x] Baseline results report status, sample count, min, max, p50, and p95 for each measured endpoint.
- [x] The baseline identifies the largest measured bottleneck for each representative endpoint before later tickets change behavior.

## Implementation Notes

- API timing now emits a request correlation id and supports safe span attributes.
- `withOperationalAuth()` runs handlers inside a request-scoped timer context so InsForge adapters can attach child spans without changing every repository call site.
- InsForge server and admin clients use a traced fetch implementation when a timer is available.
- Auth timing now separates the current InsForge session request from the `app_users` Landlord/Staff lookup.
- The baseline runner is available as `npm run perf:api-baseline`. For authenticated measurements, run it against a running dev server with `API_BASELINE_COOKIE` set to the browser session cookie.
