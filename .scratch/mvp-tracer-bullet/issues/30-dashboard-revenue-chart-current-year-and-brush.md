# 30 — Dashboard Revenue Chart Current Year and Brush Navigation

**What to build:** Improve the Dashboard revenue chart so a Landlord or Staff user can quickly switch to the current calendar year and inspect longer revenue timelines with an interactive Brush control.

**Blocked by:** 25 — Dashboard Revenue Chart Range Controls.

**Status:** done

- [x] The Dashboard revenue chart range selector includes a clear “This year” option for the current calendar year.
- [x] The “This year” option returns monthly buckets from January through December of the current year, including zero-value months when no invoices exist.
- [x] The selected “This year” range participates in Dashboard revenue query keys so cached chart data does not collide with 3 months, 6 months, 1 year, 2 years, or all periods.
- [x] Chart title, description, empty state, and accessibility label reflect the “This year” range when selected.
- [x] The revenue API or presenter normalizes the new range safely and keeps the current default behavior unchanged.
- [x] The revenue chart includes a Brush control that lets the user focus on a smaller visible window when the selected range has enough periods.
- [x] The Brush does not appear or does not degrade the layout when the chart has too few data points to benefit from brushing.
- [x] The Brush is styled consistently with the existing claymorphism dashboard theme and works in light and dark mode.
- [x] Changing the Brush window does not trigger unnecessary API requests; it should operate on the already-loaded chart data.
- [x] Changing the chart range still does not change current-period KPI cards, unpaid invoice reminders, missing utility metric reminders, or room availability.
- [x] Loading, empty, error, retry, and no-data states continue to work for every chart range.
- [x] Behavior tests cover “This year” range normalization, current-year bucket generation, zero filling, query-key separation, and preserving existing range behavior.
- [x] Typecheck, lint, and the relevant test suite pass.

## Implementation summary

- Added the calendar-aligned `this-year` range with isolated React Query keys and January-to-December zero-filled buckets.
- Added a client-only Recharts Brush for timelines longer than six periods without adding API traffic.
- Preserved the existing six-month default and current-period operational KPI queries.

## Implementation notes

- Treat “This year” as a product range, not as an alias for 1 year. It should align to the current calendar year instead of the last twelve rolling months.
- Keep Brush behavior client-side after chart data is loaded.
- Preserve the existing default range unless the user explicitly selects “This year”.
