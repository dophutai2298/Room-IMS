# 25 — Dashboard Revenue Chart Range Controls

**What to build:** Dashboard revenue chart supports selectable ranges for 3 months, 6 months, 1 year, 2 years, and all periods, while keeping six months as the default behavior.

**Blocked by:** 07 — Dashboard MVP Reminders; 16 — Optimize InsForge API Critical Path.

**Status:** done

- [x] Dashboard revenue chart has a clear range selector with options: 3 months, 6 months, 1 year, 2 years, and all periods.
- [x] The six-month range remains the default when no range is selected.
- [x] Selecting a range updates the chart without requiring a full page reload.
- [x] The selected range participates in Dashboard revenue query keys so cached results do not collide.
- [x] The revenue API or presenter accepts and normalizes the selected range with a safe fallback to six months.
- [x] The 3-month range returns three contiguous monthly buckets.
- [x] The 6-month range returns six contiguous monthly buckets.
- [x] The 1-year range returns twelve contiguous monthly buckets.
- [x] The 2-year range returns twenty-four contiguous monthly buckets.
- [x] Fixed ranges include zero-value months when no invoice exists for a month.
- [x] The all-period range includes the full available invoice history in chronological order.
- [x] Chart title, description, empty state, and accessibility label reflect the selected range instead of hardcoding six months.
- [x] Changing the chart range does not change current-period KPI cards, unpaid invoice reminders, missing utility metric reminders, or room availability.
- [x] Loading, error, retry, and no-data states continue to work for every range.
- [x] Behavior tests cover range normalization and chart output for 3 months, 6 months, 1 year, 2 years, all periods, and missing-month zero filling.
- [x] Typecheck, lint, and the existing test suite pass.

## Implementation Notes

- Keep the existing chart library and visual style.
- Prefer a small revenue-range product enum over scattered magic numbers.
- "All periods" should be implemented with care for performance, but it should not be artificially capped unless a real bottleneck is measured.
- See the invoice export and dashboard reporting spec for range semantics.

## Agent Notes

- Added the shared `3m`/`6m`/`1y`/`2y`/`all` revenue-range product enum, with `6m` as the safe default.
- Added client-side range selection with React Query keys containing billing period and range; switching range only refreshes the chart query.
- Kept KPI cards on the default revenue query, so switching the chart range does not alter KPI, unpaid-invoice, missing-metrics, or room-availability data.
- Revenue API accepts `range`, normalizes invalid values, and preserves existing operational authentication.
- Fixed ranges emit contiguous zero-filled month buckets. All periods produces chronological history from the earliest valid invoice through the Dashboard billing period, without an artificial cap.
- Chart copy, empty state, and accessibility text now use the selected range.
- Added behavior coverage for normalization, API parsing, cache-key separation, all requested ranges, zero filling, all-history, and no-data behavior.
- Verification passed: `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd test` (71/71), `npm.cmd run build`, and `git diff --check`.
