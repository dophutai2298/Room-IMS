# 16 - Optimize InsForge API Critical Path

**What to build:** The slowest measured InsForge-backed API paths are improved using the evidence from the baseline. Query count, request fan-out, SDK retry behavior, and database access are changed only where timing proves they dominate the user-visible delay.

**Blocked by:** 15 - Optimize Operational Authentication.

**Status:** implemented; live baseline pending.

- [ ] The slowest remaining representative endpoints are ranked using the tracing and baseline data from ticket 14 after ticket 15 is complete.
- [x] Any repeated read, page-level fan-out, or multi-query repository path is kept parallel where appropriate and consolidated only when the measured critical path justifies it.
- [x] Dashboard and Room-detail API usage is reviewed for repeated Auth and duplicate domain reads, with any aggregation preserving existing independent loading and retry behavior where that still benefits the UI.
- [x] SDK retry or timeout behavior is changed only if trace evidence shows retry/backoff is causing the observed delay, and expected failure behavior is documented.
- [ ] Database indexes, query shape changes, or query-plan work are added only for filters or sorts proven slow by InsForge/database evidence.
- [x] Changes preserve the current service, repository, and InsForge adapter boundaries unless the trace proves a boundary is causing material latency.
- [ ] Before/after data shows the optimized endpoints are faster without changing successful response semantics or error shape.

## Implementation Notes

- Optimized the `dashboard.missing-utility-metrics` repository path because issue 13 identified it as a secondary multi-query Dashboard path that reused the full Room list domain read.
- Replaced the nested `roomRepository.listRoomItems()` call in `src/lib/insforge/dashboard-repository.ts` with a compact Dashboard-specific read that still runs independent InsForge requests in parallel.
- Preserved response semantics by adding `buildDashboardMissingUtilityMetricsFromCompactRows()` in `src/lib/dashboard/presenter.ts`.
- The compact path keeps the same reminder behavior:
  - only occupied Rooms are shown;
  - Maintenance Rooms are excluded;
  - Rooms with metrics for the selected billing period are excluded;
  - key Tenant name and active rent override are preserved.
- Query count is intentionally not reduced in this pass because there is no live trace proving request count, SDK retry/backoff, or database execution is the dominant remaining cost after ticket 15.
- Payload shape is slimmer:
  - Rooms: `id, name, status, base_price` instead of the full Room list select.
  - Tenants: `id, full_name` instead of Tenant status/phone/key fields.
  - Active Contracts: `id, room_id, key_tenant_id, rent_amount` instead of the full Room-list Contract projection.
- SDK retry and timeout behavior was reviewed and left unchanged because there is no trace evidence showing retry/backoff caused the observed delay.
- Database indexes and query-plan changes were not added because no InsForge/database query-plan evidence is available yet.

## Verification

- `node --conditions=react-server --import tsx --test src/lib/dashboard/dashboard.behavior.test.ts`
- `npx.cmd tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd test`

## Live Baseline Needed

Run after starting the dev server and copying an authenticated browser Cookie header:

```powershell
$env:API_BASELINE_COOKIE = "<copy browser Cookie header>"
npm.cmd run perf:api-baseline
```

Compare at minimum:

- `Dashboard missing Utility Metrics`
- `Dashboard revenue`
- `Dashboard unpaid Invoices`
- `Rooms list`
- `Room detail`

Expected improvement for this code change is limited to `dashboard.missing-utility-metrics` repository time and response processing. If live traces still show most latency in `auth.session`, network, or a single InsForge request, ticket 17 should keep the current boundaries and target that measured bottleneck instead.
