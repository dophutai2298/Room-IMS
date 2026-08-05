# 07 — Add Dashboard Reminders for Monthly Operations

**What to build:** Replace static dashboard reminders and mock chart data with real InsForge-backed summaries for the monthly operations loop. The dashboard should help a Landlord or Staff member see Room availability, missing Utility Metrics, billed versus collected revenue, outstanding debt, and unpaid Invoices.

**Blocked by:** 04 — Record Monthly Utility Metrics Client Data Architecture Follow-up; 06 — Track Invoice Payment Status.

**Status:** ready-for-agent

- [ ] Dashboard revenue reflects persisted Invoice `total_amount` and `amount_paid` totals for the current billing period.
- [ ] The six-month chart replaces mock data with InsForge-backed aggregates grouped by billing period: billed from `total_amount` and collected from `amount_paid`.
- [ ] The chart preserves responsive, accessible, theme-aware behavior in light and dark modes.
- [ ] Dashboard components use the Tailwind/shadcn foundation with the restrained claymorphism operational visual style.
- [ ] Outstanding debt reflects unpaid or partially paid Invoices.
- [ ] Room availability reflects computed Room Status.
- [ ] The dashboard lists Rooms missing Utility Metrics for the current billing period.
- [ ] The dashboard lists unpaid or partially paid Invoices that need collection.
- [ ] Empty states appear when there are no reminders.
- [ ] Dashboard summaries and reminders update when the underlying InsForge data changes.

## Client Data Architecture Requirements

Folded in from `client-data-architecture-migration/issues/08-dashboard-reminders-client-data-slice.md`.

- [ ] Dashboard and Reminder reads use TanStack Query `useQuery` with independent query keys per card or section.
- [ ] Retry and background refresh use TanStack Query query state and `refetch`.
- [ ] Slow sections do not block unrelated query-backed sections where practical.
- [ ] Dashboard shell renders quickly before all dashboard data is available.
- [ ] Dashboard cards load data through authenticated app APIs rather than direct UI access to InsForge.
- [ ] Reminder data is produced through application services and repository interfaces before reaching the InsForge adapter.
- [ ] Dashboard sections support loading, empty, error, retry, and success states independently where practical.
- [ ] Reminders continue to identify Rooms missing Utility Metrics for the billing period.
- [ ] Reminders continue to identify unpaid or partially paid Invoices.
- [ ] Revenue chart data continues to distinguish billed and collected amounts.
- [ ] API timing logs identify expensive Dashboard and Reminder aggregations.
- [ ] A smoke test or behavior test verifies dashboard summary data for an authenticated Landlord or Staff user.
