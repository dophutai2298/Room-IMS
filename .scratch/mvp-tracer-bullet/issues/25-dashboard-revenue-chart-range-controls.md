# 25 — Dashboard Revenue Chart Range Controls

**What to build:** Dashboard revenue chart supports selectable ranges for 3 months, 6 months, 1 year, 2 years, and all periods, while keeping six months as the default behavior.

**Blocked by:** 07 — Dashboard MVP Reminders; 16 — Optimize InsForge API Critical Path.

**Status:** ready-for-agent

- [ ] Dashboard revenue chart has a clear range selector with options: 3 months, 6 months, 1 year, 2 years, and all periods.
- [ ] The six-month range remains the default when no range is selected.
- [ ] Selecting a range updates the chart without requiring a full page reload.
- [ ] The selected range participates in Dashboard revenue query keys so cached results do not collide.
- [ ] The revenue API or presenter accepts and normalizes the selected range with a safe fallback to six months.
- [ ] The 3-month range returns three contiguous monthly buckets.
- [ ] The 6-month range returns six contiguous monthly buckets.
- [ ] The 1-year range returns twelve contiguous monthly buckets.
- [ ] The 2-year range returns twenty-four contiguous monthly buckets.
- [ ] Fixed ranges include zero-value months when no invoice exists for a month.
- [ ] The all-period range includes the full available invoice history in chronological order.
- [ ] Chart title, description, empty state, and accessibility label reflect the selected range instead of hardcoding six months.
- [ ] Changing the chart range does not change current-period KPI cards, unpaid invoice reminders, missing utility metric reminders, or room availability.
- [ ] Loading, error, retry, and no-data states continue to work for every range.
- [ ] Behavior tests cover range normalization and chart output for 3 months, 6 months, 1 year, 2 years, all periods, and missing-month zero filling.
- [ ] Typecheck, lint, and the existing test suite pass.

## Implementation Notes

- Keep the existing chart library and visual style.
- Prefer a small revenue-range product enum over scattered magic numbers.
- "All periods" should be implemented with care for performance, but it should not be artificially capped unless a real bottleneck is measured.
- See the invoice export and dashboard reporting spec for range semantics.
