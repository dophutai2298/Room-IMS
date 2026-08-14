# 17 - Performance Regression Test and Cleanup

**What to build:** The performance work ends with repeatable proof and clean observability. Developers can rerun the original slow scenarios, compare before/after latency, and keep only bounded diagnostics that are safe for ongoing development.

**Blocked by:** 15 - Optimize Operational Authentication; 16 - Optimize InsForge API Critical Path.

**Status:** authenticated read baseline captured; Invoice generation sample pending.

- [x] The original read scenarios are rerun, including Invoices list, Room detail, Dashboard, Tenant directory/detail, and Utility Metrics.
- [ ] Invoice generation is rerun with controlled Server Action samples.
- [x] Regression output compares before and after p50, p95, min, max, status, and sample count for each representative endpoint.
- [x] API contract and behavior smoke tests confirm response semantics, auth behavior, loading states, and retry/error states still work after performance changes.
- [x] Temporary noisy diagnostic logs are removed, downgraded, or replaced with bounded production-safe observability.
- [x] The final performance note explains where the bottleneck moved after optimization and whether any remaining latency is expected network/InsForge time.
- [x] The parent performance issue remains open or is updated separately only when the user explicitly asks for issue-status changes.

## Implementation Notes

- `npm run perf:api-baseline` now loads local `.env`, accepts either `API_BASELINE_COOKIE` or the legacy `NEXT_API_BASELINE_COOKIE`, and never logs the cookie value.
- The harness writes a versioned JSON artifact, records payload size context, and can compare it with `API_BASELINE_BEFORE`. The comparison includes before/after status, sample count, min, p50, p95, max, and p50/p95 deltas.
- A missing or expired Auth cookie stops the operational baseline early. `API_BASELINE_ALLOW_UNAUTHENTICATED=true` is available only for intentional 401/Auth checks.
- Invoice generation is a mutating Next.js Server Action, so the harness does not submit it repeatedly. The action now emits the same bounded timing vocabulary through `invoice-generation.action`. Controlled UI sample totals can be included with `API_BASELINE_INVOICE_GENERATION_SAMPLES`, with the cold sample first.
- API contract regression tests cover Invoices, Room detail, Dashboard, Tenant directory/detail, and Utility Metrics response semantics. Route behavior tests continue to cover successful Landlord/Staff Auth and 401/403/error short-circuits. TanStack Query smoke coverage verifies pending-to-success behavior and the configured single retry.
- `[api-timing]` logs remain enabled for local development. Production logging is disabled by default and requires the explicit `API_TIMING_LOG_ENABLED=true` opt-in. Timing metadata remains bounded and sanitized.
- The authenticated read baseline was captured on 2026-08-14 at `2026-08-14T08:57:01.028Z`: 16 endpoints, all HTTP 200, with 5 warm samples each. The artifact is `.scratch/performance/api-baseline-latest.json`.
- The artifact does not include `invoice-generation-action`; that controlled mutation remains the only scenario not represented in the current baseline.
- No before artifact was supplied, so this run provides a valid current baseline but not a numeric before/after delta.
- The parent issue 13 was intentionally left unchanged.

## Verification

- `node --conditions=react-server --import tsx --test scripts/api-performance-report.behavior.test.ts src/lib/api/api-regression.behavior.test.ts src/lib/api/timing.behavior.test.ts`
- `npx.cmd tsc --noEmit`
- `npm.cmd run lint`
- `npm.cmd test`

## Remaining Live Evidence

Refresh the Auth cookie, then collect the after artifact:

```powershell
$env:API_BASELINE_OUTPUT = ".scratch/performance/after.json"
$env:API_BASELINE_INVOICE_GENERATION_SAMPLES = "<cold-ms>,<warm-ms>,<warm-ms>,<warm-ms>,<warm-ms>,<warm-ms>"
npm.cmd run perf:api-baseline
```

If a pre-optimization artifact is available, compare it in the same run:

```powershell
$env:API_BASELINE_BEFORE = ".scratch/performance/before.json"
$env:API_BASELINE_OUTPUT = ".scratch/performance/after.json"
npm.cmd run perf:api-baseline
```

See `../performance-regression-note.md` for the evidence interpretation and trace review checklist.
