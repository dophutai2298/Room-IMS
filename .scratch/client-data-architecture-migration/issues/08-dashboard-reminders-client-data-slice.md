# 08 — Dashboard and Reminders Client Data Slice

**What to build:** Move Dashboard and monthly Reminder data into independently loading client data sections so operational cards and charts can appear progressively.

**Blocked by:** 01 — Client Data Architecture Foundation; 02 — Invoices Client Data Slice; 04 — Utility Metrics Client Data Slice; MVP 07 — Dashboard MVP Reminders.

**Status:** ready-for-agent

## TanStack Query requirement

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
