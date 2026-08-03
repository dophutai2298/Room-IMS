# 07 — Add Dashboard Reminders for Monthly Operations

**What to build:** Replace static dashboard reminders and mock chart data with real InsForge-backed summaries for the monthly operations loop. The dashboard should help a Landlord or Staff member see Room availability, missing Utility Metrics, billed versus collected revenue, outstanding debt, and unpaid Invoices.

**Blocked by:** 06 — Track Invoice Payment Status.

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
