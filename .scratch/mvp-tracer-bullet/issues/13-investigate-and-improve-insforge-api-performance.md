# 13 — Investigate and Improve InsForge API Performance

**What to build:** Establish a measurable latency baseline for every operational API that calls InsForge, identify the real cost of Auth, Service, Repository, InsForge SDK, and PostgreSQL work, then apply only evidence-backed optimizations while keeping the current vertical-slice architecture.

**Blocked by:** 02 — Set Up InsForge DB, Authentication, and API Foundation; 07 — Add Dashboard Reminders for Monthly Operations; 12 — Rooms Client Data and Room Management.

**Status:** Diagnosis complete; implementation pending.

## Problem Statement

Operational API responses currently take approximately 1–2 seconds in the local UI even though the InsForge dataset is small. Room detail can take more than 3 seconds from the user's perspective. The current API timing metadata groups several expensive operations together, so it does not yet prove whether the dominant cost is authentication, an InsForge database request, SDK retry behavior, network distance, or page-level request fan-out.

The application already has a shared `withOperationalAuth()` route wrapper, service boundaries, repository interfaces, InsForge adapters, TanStack Query client reads, and API timing metadata. The investigation must preserve these boundaries unless measurement proves that a boundary is causing material latency.

## Diagnosis Findings

### Confirmed bottleneck: operational Auth round-trip

The current operational authentication path is:

1. Create an SSR InsForge client using the request cookies.
2. Call InsForge `auth.getCurrentUser()`.
3. Query `app_users` by `auth_user_id` to resolve the Landlord or Staff role.
4. Only then execute the route handler.

The two remote operations in steps 2 and 3 are sequential. The current `withOperationalAuth()` wrapper waits for this complete path before entering Service and Repository work.

The existing development timing log contains 20 API traces. Representative traces include:

- `foundation.current-user`: total `1228.81ms`; current-user repository `1119.73ms`.
- `dashboard.revenue`: total `1135.64ms`; Auth `1034.59ms`; Dashboard repository `100.62ms`.
- `dashboard.unpaid-invoices`: total `1122.30ms`; Auth `802.40ms`; Dashboard repository `319.19ms`.
- `rooms.list`: total `1243.07ms`; Auth `945.35ms`; Room repository `295.78ms`.
- Later warm requests still show Auth between approximately `275ms` and `669ms`, while some downstream repository work is between approximately `68ms` and `491ms`.

Across the captured traces, Auth is consistently the largest measured span for the slow requests. This explains why a small database can still produce a slow response: every operational API pays the authentication cost before its own data query starts.

### Confirmed: `createInsForgeServerClient()` is not the network bottleneck

The InsForge SSR client factory reads runtime configuration, reads the access-token cookie, and constructs an SDK object. The SDK client constructor does not perform an HTTP request. Existing timing contains client-init spans of approximately `0.14ms` to `2.59ms` where that span is present. Client construction should not be optimized as if it were a remote call.

Creating a second client inside a repository is still unnecessary object work and can make ownership unclear, but current evidence does not support it as the cause of the 1–2 second latency.

### Confirmed: repeated Auth across page-level API fan-out

Client pages intentionally use independent TanStack Query calls. For example, the Dashboard can request revenue, shared Room data, missing Utility Metrics, and unpaid Invoices independently. Room detail can request detail, operations summary, Tenants, and Contracts independently. Each request passes through `withOperationalAuth()` and repeats the same Auth → `app_users` resolution.

This preserves independent loading states but multiplies the Auth cost across one page load. It is a page-level amplification of the confirmed Auth bottleneck, not evidence that the client architecture itself is incorrect.

### Confirmed: most read-side repository fan-out is parallel, not sequential

The main read repositories use `Promise.all()` for related reads such as Rooms plus Tenants plus active Contracts, or Invoices plus Rooms. Therefore, the primary list/detail paths do not currently show a classic sequential N+1 pattern at the top level.

However, the number of remote requests remains high for some endpoints. Dashboard missing Utility Metrics combines the Room list path with a metrics query, and the Room list path itself reads Rooms, Tenants, and active Contracts. Tenant directory/detail paths add Room, active Contract, and CCCD-image reads after the tenant query. These are candidates for consolidation only if per-request instrumentation proves they dominate after Auth is measured separately.

### Confirmed secondary sequential operations

Some write paths contain sequential remote work by design:

- Tenant CCCD uploads upload images one at a time before inserting metadata.
- Utility Pricing creation deactivates older active prices one at a time.
- Tenant deletion verifies references, reads images, deletes the row, and then removes storage objects in sequence.
- Invoice payment updates the Invoice and then reads its Room to build the response.
- Utility Metrics and Invoice generation perform an initial parallel read followed by a write, with a conflict-recovery read/write path when needed.

These paths may be slow for writes or multiple-image uploads, but they do not explain the observed slow read of `/invoices` by themselves.

### Not yet proven: InsForge API versus PostgreSQL query time

The current repository spans measure a group of SDK calls as one block. They do not expose the duration, status, retry attempt, or endpoint for each underlying InsForge request. Consequently, the current evidence cannot distinguish:

- network time between the Next.js process and InsForge;
- InsForge API/PostgREST processing;
- PostgreSQL execution or missing indexes;
- SDK retry/backoff after a transient network or 5xx response;
- response parsing or payload transfer.

This missing split is the next required diagnostic seam. No optimization should be accepted until it is available for representative endpoints.

### Additional observation

There is a legacy server-action repository path for Invoice generation and Utility Metrics that resolves Auth internally rather than receiving the authenticated app user from the route boundary. It is outside the current `withOperationalAuth()` API wrapper and should be measured separately to ensure it does not create a second authentication pattern or bypass the common timing contract.

## Solution

Add diagnostic instrumentation at the highest useful seams, run a repeatable warm/cold latency baseline for all InsForge-backed operational APIs, and record the evidence in the API timing metadata and server logs. After the evidence identifies the dominant cost, implement the smallest targeted optimization that preserves the current vertical slices.

The first implementation stage is instrumentation only. The second stage may optimize Auth reuse, request fan-out, repository query shape, database indexes, SDK retry configuration, or API aggregation—but only when the measured data supports that change.

## User Stories

1. As a Landlord, I want API timing to show separate Auth, Service, Repository, InsForge request, and database-related durations, so that a slow screen has an actionable cause.
2. As a Staff member, I want authenticated API requests to avoid unnecessary repeated work within the same request, so that operational screens respond faster.
3. As a developer, I want `withOperationalAuth()` to expose the authenticated app user to the handler and timing context, so that downstream layers do not resolve the same user again.
4. As a developer, I want the SSR InsForge client initialization cost measured independently from remote requests, so that local object construction is not mistaken for network latency.
5. As a developer, I want each InsForge request to include a safe operation label, HTTP method, endpoint category, status, retry count, and duration, so that SDK/network/API latency can be separated without logging credentials or personal data.
6. As a developer, I want the timing system to identify whether the SDK retried a request, so that an occasional 2-second response is not misdiagnosed as a slow database query.
7. As a developer, I want Auth timing to distinguish the current-session request from the `app_users` role query, so that the slow Auth sub-step is measurable.
8. As a developer, I want Repository timing to identify every remote query in a multi-query operation, so that `Promise.all()` fan-out and the slowest child query are visible.
9. As a developer, I want a request correlation identifier to connect route timing, service timing, repository timing, and InsForge request timing, so that one API response can be traced end to end.
10. As a developer, I want timing logs to avoid access tokens, cookies, API keys, tenant personal data, CCCD data, and full request bodies, so that diagnostics do not create a privacy or security issue.
11. As a developer, I want a repeatable baseline for cold-start and warm requests, so that first-request module loading is not confused with steady-state network latency.
12. As a developer, I want p50, p95, minimum, maximum, and request count reported for representative endpoints, so that an optimization is evaluated against distributions rather than one lucky request.
13. As a developer, I want the baseline to cover Room list, Room detail, Invoices list, Dashboard summaries, Tenant directory/detail, Contracts, Utility Metrics, Utility Pricing, Staff, and Foundation endpoints, so that fixing one slice does not hide a shared bottleneck in another slice.
14. As a developer, I want the Invoice-generation and Utility-Metrics server actions measured using the same Auth and InsForge request vocabulary as API routes, so that there is one performance model for all InsForge access.
15. As a developer, I want database query plans or equivalent InsForge database evidence for the slowest filters and sorts, so that indexes are added only when a query plan demonstrates a need.
16. As a developer, I want the Room list and Dashboard availability paths to share the existing Room domain read contract, so that performance work does not reintroduce a duplicate dashboard-only data path.
17. As a developer, I want Dashboard requests to remain independently loadable while having the option to use one measured summary endpoint if repeated Auth dominates the page waterfall, so that UX responsiveness and backend efficiency can be balanced with evidence.
18. As a user, I want loading and retry behavior to remain correct while API timing is collected, so that diagnostics do not make the management UI less usable.
19. As a developer, I want a regression performance check for the originally slow endpoints, so that a future refactor cannot silently restore the 1–2 second overhead.
20. As a maintainer, I want the current service/repository/InsForge adapter boundaries preserved unless a measured result justifies a change, so that performance work does not become an uncontrolled architecture rewrite.

## Implementation Decisions

- Keep the current `withOperationalAuth()` wrapper as the common route boundary. Extend its timing context and authenticated-user handoff only where the measurements show duplicated work.
- Treat Auth as two explicit remote spans: current InsForge session resolution and `app_users` role/profile resolution. Keep the total Auth span for compatibility with existing API metadata.
- Treat SSR InsForge client construction as a local initialization span. Do not add a global client cache until request-cookie isolation, token safety, and server concurrency behavior are proven.
- Add request-scoped client reuse where multiple repository operations belong to one request and share the same authenticated cookie context. The client must not leak access tokens or cookies across requests.
- Instrument the InsForge SDK boundary through a safe fetch/request hook or equivalent adapter seam. Record operation category, method, sanitized path category, status, retry attempt, and duration. Never record authorization headers, cookie values, API keys, file contents, CCCD URLs, or raw personal data.
- Add child timing spans for each database or storage operation in the InsForge adapters. A parent Repository span must remain so existing consumers can compare before and after measurements.
- Preserve existing `Promise.all()` parallelism for independent reads. Do not convert parallel reads to sequential reads. Any consolidation or query reduction must be justified by measured request count and critical-path duration.
- Review repeated page-level Auth calls. If Auth is the dominant cost after instrumentation, prefer a measured solution such as a safe request/session-level identity representation or a purpose-built aggregated read endpoint. Do not assume that browser-side caching alone removes server Auth cost.
- Review whether current-role lookup can be resolved without a separate `app_users` round-trip while preserving authorization correctness. JWT claims, cached mappings, or database-side composition are acceptable only after security and invalidation behavior are specified and tested.
- Review database indexes for the actual filter/sort patterns used by Rooms, Tenants, Contracts, Utility Metrics, Invoices, Utility Pricing, `app_users`, and CCCD images. Add migrations only for indexes supported by query-plan evidence.
- Measure and separately address SDK retry/backoff. Do not reduce retries or timeouts globally without proving that the observed delay is retry-related and without defining the failure behavior expected by the management UI.
- Keep Dashboard Room availability on the shared Room list contract. If Dashboard aggregation is consolidated, it must reuse the existing Room domain semantics for computed availability and Maintenance status.
- Preserve the current client-data architecture and independent TanStack Query states unless a measured page waterfall shows that an aggregated read materially improves time to useful data without harming retry/error isolation.
- Remove temporary diagnostic logs after the investigation is complete, or replace them with bounded production-safe observability at an agreed log level.

## Testing Decisions

- Tests must assert external timing/trace behavior and API response semantics, not private helper implementation details.
- Add a deterministic instrumentation test using fake fetch/InsForge boundaries that verifies the trace contains Auth session, role lookup, client initialization, repository child operations, status, and retry metadata without secrets.
- Add route-level tests for `withOperationalAuth()` proving that Auth is resolved once per incoming request, the authenticated user reaches the handler, role failures short-circuit the handler, and timing metadata is emitted on success and failure.
- Add repository behavior tests for representative Room list, Room detail, Invoice list, Dashboard missing-metrics, Tenant directory, and Utility Metrics operations. Verify query count and concurrency shape where it is externally meaningful.
- Add a performance harness that can run against a local dev server and a configured InsForge project. It must execute cold and warm samples, record p50/p95/min/max, and preserve the response status and payload-size context.
- Add a production-like trace review checklist covering network request duration, retry count, InsForge API duration, database/query-plan evidence, and Next.js server time.
- Re-run the original user scenarios: `/invoices`, Room detail, Dashboard, Tenant directory, Utility Metrics, and Invoice generation. The regression check must verify both response correctness and latency budget.
- Use the existing API contract smoke and behavior smoke patterns as prior art. Add a real timing seam only where the existing contract tests cannot observe the required external behavior.

## Out of Scope

- Rewriting the application from server architecture to a different backend architecture.
- Replacing InsForge, the current service/repository/adapter layering, or TanStack Query.
- Adding speculative global caching of authenticated users or InsForge clients without request-isolation and security evidence.
- Removing authentication or weakening Landlord/Staff authorization to improve latency.
- Logging access tokens, cookies, API keys, raw SQL credentials, tenant personal data, CCCD data, or full request payloads.
- Broad UI redesign, SEO optimization, or unrelated hydration fixes.
- Optimizing client rendering or chart performance before API/server latency is separated from browser rendering time.
- Adding database indexes, RPCs, or aggregate endpoints without a measured bottleneck and a migration/rollback decision.

## Further Notes

The current evidence supports the following ranking:

1. Auth round-trip and repeated Auth across independent API calls — confirmed primary bottleneck.
2. InsForge network/API latency or retry behavior — plausible, but not yet split from the grouped repository/auth spans.
3. Repository query count and endpoint fan-out — confirmed secondary cost on selected Dashboard, Room, Tenant, and Utility flows.
4. Database indexes/query plans — plausible secondary cause, requiring InsForge/PostgreSQL evidence.
5. `createInsForgeServerClient()` construction and `withOperationalAuth()` wrapper overhead — not supported as primary causes by current timing.

Expected improvement is intentionally expressed as a measurement gate rather than an unverified promise. The first milestone is to explain the complete API critical path and identify the dominant remote operation for each representative endpoint. The optimization milestone should then target:

- removing duplicated Auth work where safe;
- reducing repeated page-level Auth round-trips or combining reads only when the waterfall justifies it;
- keeping independent reads parallel while reducing unnecessary query count;
- fixing only query/index/retry issues proven by child timing and query-plan evidence.

The acceptance target is that the original `/invoices` and Room-detail scenarios have a documented before/after p50 and p95, with the response time no longer dominated by unexplained Auth overhead. A numeric target should be set after the first complete trace because current logs do not yet expose the split needed to guarantee a responsible percentage improvement.

Evidence sources used for this diagnosis:

- Existing `[api-timing]` records in the local Next.js development log.
- Current route-wrapper, Auth service/repository, InsForge client factory, and InsForge adapter behavior.
- Installed InsForge SDK behavior for SSR client construction, current-user requests, retry defaults, timeout behavior, and request handling.
- Current schema/migration index definitions and repository query patterns.
