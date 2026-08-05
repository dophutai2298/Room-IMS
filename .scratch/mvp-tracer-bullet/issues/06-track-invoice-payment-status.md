# 06 — Track Invoice Payment Status

**What to build:** Let a Landlord review persisted Invoices, record the amount received, and update payment status among unpaid, partially paid, and paid, so monthly collections and collected-revenue statistics remain accurate without falling back to spreadsheets.

**Blocked by:** 05 — Generate Invoices From Utility Metrics.

**Status:** ready-for-agent

- [ ] The Invoice list shows persisted Invoices for the selected or current billing period.
- [ ] The Invoice list uses shadcn Table, Badge, Select or Dialog patterns where appropriate.
- [ ] Each Invoice displays total amount, Room, billing period, and payment status.
- [ ] Each Invoice displays `amount_paid` and the remaining balance.
- [ ] A Landlord can record a payment amount and change status to unpaid, partially paid, or paid.
- [ ] Unpaid sets `amount_paid` to 0, paid sets it to `total_amount`, and partially paid requires an amount greater than 0 and lower than `total_amount`.
- [ ] The app rejects negative payment amounts and amounts greater than the Invoice total with an inline validation message.
- [ ] Status changes persist after refresh.
- [ ] The list visually distinguishes unpaid, partially paid, and paid Invoices.
- [ ] Status update errors are visible without losing the current list context.

## Client Data Architecture Requirements

- [ ] Invoice payment reads use TanStack Query `useQuery` with stable Invoice query keys.
- [ ] Recording or changing payment status uses TanStack Query `useMutation`.
- [ ] Successful payment mutations invalidate or update affected Invoice list, Room operations summary, and Dashboard revenue query keys.
- [ ] Payment read and write APIs use application services and repository interfaces before reaching the InsForge adapter.
- [ ] API responses use the standard success/failure envelope.
- [ ] API timing logs identify auth, validation, service, and InsForge write duration.
- [ ] A smoke test or behavior test verifies valid payment updates and rejects invalid `amount_paid`/status combinations.
