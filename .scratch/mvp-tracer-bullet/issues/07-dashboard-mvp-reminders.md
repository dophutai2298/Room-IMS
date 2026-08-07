# 07 — Add Dashboard Reminders for Monthly Operations

**What to build:** Replace static dashboard reminders and mock chart data with real InsForge-backed summaries for the monthly operations loop. The dashboard should help a Landlord or Staff member see Room availability, missing Utility Metrics, billed versus collected revenue, outstanding debt, and unpaid Invoices.

**Blocked by:** 04 — Record Monthly Utility Metrics Client Data Architecture Follow-up; 06 — Track Invoice Payment Status.

**Status:** Done

- [x] Dashboard revenue reflects persisted Invoice `total_amount` and `amount_paid` totals for the current billing period.
- [x] The six-month chart replaces mock data with InsForge-backed aggregates grouped by billing period: billed from `total_amount` and collected from `amount_paid`.
- [x] The chart preserves responsive, accessible, theme-aware behavior in light and dark modes.
- [x] Dashboard components use the Tailwind/shadcn foundation with the restrained claymorphism operational visual style.
- [x] Outstanding debt reflects unpaid or partially paid Invoices.
- [x] Room availability reflects computed Room Status.
- [x] The dashboard lists Rooms missing Utility Metrics for the current billing period.
- [x] The dashboard lists unpaid or partially paid Invoices that need collection.
- [x] Empty states appear when there are no reminders.
- [x] Dashboard summaries and reminders update when the underlying InsForge data changes.

## Client Data Architecture Requirements

Folded in from `client-data-architecture-migration/issues/08-dashboard-reminders-client-data-slice.md`.

- [x] Dashboard and Reminder reads use TanStack Query `useQuery` with independent query keys per card or section.
- [x] Retry and background refresh use TanStack Query query state and `refetch`.
- [x] Slow sections do not block unrelated query-backed sections where practical.
- [x] Dashboard shell renders quickly before all dashboard data is available.
- [x] Dashboard cards load data through authenticated app APIs rather than direct UI access to InsForge.
- [x] Reminder data is produced through application services and repository interfaces before reaching the InsForge adapter.
- [x] Dashboard sections support loading, empty, error, retry, and success states independently where practical.
- [x] Reminders continue to identify Rooms missing Utility Metrics for the billing period.
- [x] Reminders continue to identify unpaid or partially paid Invoices.
- [x] Revenue chart data continues to distinguish billed and collected amounts.
- [x] API timing logs identify expensive Dashboard and Reminder aggregations.
- [x] A smoke test or behavior test verifies dashboard summary data for an authenticated Landlord or Staff user.

## Implementation Notes

- Replaced static dashboard mock data with a client Dashboard shell backed by TanStack Query.
- Added authenticated Dashboard app APIs for revenue, room availability, missing Utility Metrics, and unpaid Invoices.
- Added Dashboard service/repository interfaces and an InsForge adapter so UI never reads InsForge directly.
- Revenue chart now receives persisted billed and collected aggregates for the six most recent billing periods.
- Mutations that affect Dashboard data invalidate Dashboard query keys after saving Utility Metrics, generating Invoices, or recording Invoice payments.
- Added API contract smoke data and presenter behavior smoke coverage for Dashboard summaries.
