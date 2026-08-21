# 26 — Optimize Remaining InsForge API Critical Paths

**What to build:** Authenticated management screens load faster because the remaining high-cost InsForge reads are bounded, repeated page-level authentication fan-out is reduced, deployment compute is located near InsForge, and Invoice generation uses the common API mutation path. The improvement is demonstrated with equivalent authenticated before/after performance reports.

**Blocked by:** 14 — Add API Tracing and Performance Baseline; 15 — Optimize Operational Authentication; 16 — Optimize InsForge API Critical Path; 25 — Dashboard Revenue Chart Range Controls. Their implementation prerequisites are already present, so this follow-up can start immediately and absorbs their remaining live-baseline evidence.

**Status:** done

- [x] An authenticated “before” report is captured with the existing performance harness, all operational endpoints return HTTP 200, and credentials/cookies are never written to source control or report artifacts.
- [x] Vercel Function execution is explicitly located in the supported Southeast Asia region nearest the project’s `ap-southeast` InsForge deployment, with the chosen locality documented for production verification.
- [x] Dashboard initial loading performs one authenticated summary read for current-period revenue, missing Utility Metrics, and unpaid Invoices while preserving the existing Room availability query and independent chart-range refresh behavior.
- [x] Invoice list reads no unrelated Room rows and returns the same public response and payment behavior.
- [x] Dashboard revenue reads only the requested fixed date range; the all-period option remains intentionally unbounded and keeps chronological zero-filled output semantics.
- [x] Utility Metrics reads request only the selected Room and the minimum history needed to calculate the selected billing period, while create/update behavior and conflict handling remain unchanged.
- [x] The legacy Invoice-generation Server Action is replaced by an authenticated HTTP API mutation consumed through TanStack Query, preserving validation, success feedback, cache invalidation, and error behavior.
- [x] Active critical-path repositories reuse one request-scoped InsForge client and do not use broad `select all` projections where a bounded projection is sufficient.
- [x] Public API behavior tests cover the consolidated Dashboard read, bounded query inputs, authenticated Invoice generation, and unchanged error envelopes before implementation is considered complete.
- [x] An equivalent authenticated “after” report is captured from the same machine, server mode, account, billing period, and sample count; the report compares p50 and p95 for every endpoint.
- [x] Targeted endpoints show a lower p50 or fewer remote InsForge operations, no endpoint has an unexplained material regression, and remaining latency is documented as Auth, network, InsForge, or application work using trace spans.
- [x] Typecheck, lint, full behavior tests, production build, and diff checks pass.

## Measurement Notes

- Use a local production server for both reports so development compilation and Vercel deployment drift do not distort the code-level comparison.
- Keep the authenticated account, database contents, billing month/year, warm sample count, and server lifecycle equivalent between runs.
- Treat Vercel region locality as a separately verified production setting because a local before/after run cannot measure Vercel-to-InsForge network distance.
- Store only bounded latency summaries and sanitized timing spans. Never store the Admin password, Cookie header, access token, refresh token, API key, tenant personal data, or request bodies.

## Implementation Notes

- Production Functions are pinned to Vercel `sin1` (Singapore), adjacent to the configured `ap-southeast` InsForge host. This takes effect on the next Vercel deployment.
- Operational Auth validates the InsForge session and speculatively reads the matching `app_users` row in parallel. A JWT subject is accepted only as a UUID candidate and is never trusted unless it matches the validated session user.
- Dashboard current-period revenue, missing Utility Metrics, and unpaid Invoices now share `/api/dashboard/operations-summary`; non-default chart ranges retain their own React Query request and cache key.
- Fixed Dashboard ranges are split into exact per-year month segments. The `all` option intentionally reads all Invoice periods.
- Invoice list uses the Room foreign-key expansion and maps joined rows in O(n), without loading unrelated Rooms.
- Utility Metrics reads the current period plus the latest earlier same-year row. It queries the latest prior-year row only when no same-year predecessor exists.
- Invoice generation now uses `POST /api/rooms/:id/invoices` through `useMutation`. Historical terminated Contracts remain billable when their dates cover the period, and regeneration uses a conditional payment snapshot so a concurrent payment cannot be overwritten.
- Critical-path repositories reuse one request-scoped InsForge client and use explicit projections. The unused legacy rental repository and Invoice Server Action were removed.

## Performance Results

- Reports: `.scratch/performance/before.json`, `.scratch/performance/after.json`, and `.scratch/performance/after-diagnostics.json`. No credentials, Cookie headers, tokens, request bodies, or tenant personal data are stored in them.
- Equivalent production-mode reports use one cold plus five warm samples for 16 endpoints, month 08/2026, the same machine/account/data, and HTTP 200 throughout. Fifteen of sixteen endpoints improve p50 by 10.7%–38.6% (average 21.1%, median 19.5%).
- The five-sample `foundation-seeded-data` p50 was distorted by a clustered InsForge tail-latency burst. Its 20-sample diagnostic is p50 178.00 ms and p95 197.39 ms versus before p50 245.74 ms and p95 729.16 ms; the isolated maximum contains an InsForge database span of 892.64 ms.
- Utility Metrics 20-sample diagnostics are p50 181.23 ms and p95 235.26 ms versus before p50 228.59 ms and p95 237.44 ms. The conditional prior-year lookup removes one unnecessary remote query for the measured period.
- Dashboard operations summary is p50 171.95 ms. Using the slower of summary and `/api/rooms`, estimated initial Dashboard critical-path p50 falls from 228.90 ms to 188.02 ms (17.9%).
- Remaining tail spikes are traced to individual remote `insforge.database` spans (for example 584–893 ms) while neighboring calls in the same run remain near their normal range. They are documented as InsForge/network variance rather than hidden or attributed to client rendering.
- The mutating Invoice-generation endpoint is not repeated against production data. Its authenticated HTTP success path is covered with an injected repository test, and the live authenticated validation path returns the expected HTTP 400 without writing data.

## Verification

- `npm test`: 86 passed, 0 failed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed on Next.js 16.2.12.
- `npm run lint`: exit 0 with one pre-existing unused-import warning in `src/components/layout/account-menu.tsx` and no errors.
- `git diff --check`: passed; Git emitted only existing LF/CRLF conversion notices.
- Two-axis code review completed; the standards reviewer reported no unresolved findings after remediation.
