# InsForge API Performance Regression Note

Date: 2026-08-14

## Outcome

An authenticated read baseline was captured on 2026-08-14 at `2026-08-14T08:57:01.028Z`: 16 endpoints, all HTTP 200, with 5 warm samples per endpoint. The current artifact is `.scratch/performance/api-baseline-latest.json`.

The read APIs are now materially below the original 1–2 second API symptom in this sample. For example, `/api/invoices` is `280.90ms` warm p50 and `299.86ms` p95, while Room detail is `291.49ms` p50 and `303.67ms` p95. This is an endpoint baseline, not a full browser page-load measurement, so it does not by itself prove the entire `/invoices` or Room-detail UI waterfall is below 300ms.

The artifact does not contain Invoice generation because that is a mutating Server Action. A controlled UI run with `invoice-generation.action` totals is still required before the original scenario set is complete. No before artifact was supplied, so the current run cannot produce a numeric before/after delta.

The bottleneck has narrowed: Auth remains the largest recurring p50 span on most endpoints, while Room tenants and Tenant directory show Service/related-data work as the larger span. Ticket 15 removes duplicate app-user resolution within one incoming request; separate client API requests still perform their own Auth boundary. Ticket 16 reduces Dashboard missing-metrics query shape and presenter work without reducing remote request count.

## Evidence Available Before the Final Rerun

- Historical `createInsForgeServerClient()` initialization: approximately `0.14ms` to `2.59ms`; this is not the primary bottleneck.
- Historical `dashboard.revenue`: `1135.64ms` total, including `1034.59ms` Auth.
- Historical `rooms.list`: `1243.07ms` total, including `945.35ms` Auth.
- Historical `dashboard.unpaid-invoices`: `1122.30ms` total, including `802.40ms` Auth.
- Later historical warm requests still showed approximately `275ms` to `669ms` Auth.
- Current baseline: all 16 read endpoints returned HTTP `200`, each with `samples=5`.
- Current warm p50 leaders: Room tenants `463.43ms`, Tenants directory `369.81ms`, Tenant detail `369.03ms`.
- Current warm p95 leaders: Rooms list `564.58ms`, Room tenants `531.85ms`, Tenants directory `387.46ms`.
- Current cold spikes: Foundation seeded data `824.58ms` and Dashboard missing Utility Metrics `793.13ms`, compared with warm p50 values of `298.99ms` and `277.11ms`; this indicates first-hit/cold-start variability in the local dev run.
- Payload sizes are small: current warm p50 ranges from `1,011` bytes for current user to `9,966` bytes for seeded data. Payload transfer is not the dominant explanation for the earlier latency.

## Expected Remaining Latency

After request-local duplicate Auth work is removed, remaining latency is expected to be dominated by real remote work: the InsForge current-session request, the `app_users` role lookup, and endpoint-specific InsForge database requests. The artifact's `largestSpan` shows Auth around `162–185ms` p50 on most endpoints. Room tenants has a Service span of `254.68ms` p50 and Tenant directory has a Service span of `179.49ms` p50, so those paths should be investigated separately for related-data fan-out. The baseline does not include enough child-span detail to claim N+1 or database-plan problems.

## Repeatable Measurement

1. Start the app and sign in.
2. Copy a fresh browser Cookie request header into `API_BASELINE_COOKIE` or `NEXT_API_BASELINE_COOKIE` without committing it.
3. Run controlled Invoice-generation submissions from the UI and copy the `total` values from the bounded `[api-timing] invoice-generation.action` records. Put the cold value first in `API_BASELINE_INVOICE_GENERATION_SAMPLES`.
4. Run `npm.cmd run perf:api-baseline`. The default output is `.scratch/performance/api-baseline-latest.json`.
5. Set `API_BASELINE_BEFORE` to a prior JSON artifact to print a side-by-side comparison of status, count, min, p50, p95, and max.

## Current Baseline Summary

| Endpoint | Warm p50 | Warm p95 | Cold | Largest p50 span |
| --- | ---: | ---: | ---: | --- |
| Invoices list | 280.90ms | 299.86ms | 305.30ms | Auth 183.30ms |
| Room detail | 291.49ms | 303.67ms | 339.69ms | current-user repository 174.30ms |
| Rooms list | 290.38ms | 564.58ms | 279.41ms | Auth 169.41ms |
| Room tenants | 463.43ms | 531.85ms | 523.71ms | Service 254.68ms |
| Tenant directory | 369.81ms | 387.46ms | 408.09ms | Service 179.49ms |
| Tenant detail | 369.03ms | 378.85ms | 415.11ms | Auth 173.36ms |
| Utility Metrics read | 292.48ms | 301.60ms | 523.62ms | Auth 176.37ms |
| Dashboard missing Utility Metrics | 277.11ms | 356.90ms | 793.13ms | Auth 173.70ms |

The full 16-endpoint artifact remains the source of truth; this table highlights the representative slow scenarios only.

## Trace Review Checklist

- Confirm all representative scenarios return their expected successful HTTP/action status.
- Compare p50 and p95, not only a single request.
- Compare `auth.session`, `auth.app-user.lookup`, `insforge.client-init`, Repository parent spans, and `insforge.*` child spans.
- Check `retryAttempt` and `retryCount` before changing SDK retry behavior.
- Treat an InsForge child span as network/API/database combined time unless separate query-plan evidence exists.
- Do not add indexes without a slow filter/sort and query-plan evidence.
- Never include cookies, tokens, request bodies, Tenant personal data, CCCD data, or storage URLs in artifacts or logs.
