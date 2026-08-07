# 06 — Track Invoice Payment Status

**What to build:** Let a Landlord review persisted Invoices, record the amount received, and update payment status among unpaid, partially paid, and paid, so monthly collections and collected-revenue statistics remain accurate without falling back to spreadsheets.

**Blocked by:** 05 — Generate Invoices From Utility Metrics.

**Status:** done

- [x] The Invoice list shows persisted Invoices for the selected or current billing period.
- [x] The Invoice list uses shadcn Table, Badge, Select or Dialog patterns where appropriate.
- [x] Each Invoice displays total amount, Room, billing period, and payment status.
- [x] Each Invoice displays `amount_paid` and the remaining balance.
- [x] A Landlord can record a payment amount and change status to unpaid, partially paid, or paid.
- [x] Unpaid sets `amount_paid` to 0, paid sets it to `total_amount`, and partially paid requires an amount greater than 0 and lower than `total_amount`.
- [x] The app rejects negative payment amounts and amounts greater than the Invoice total with an inline validation message.
- [x] Status changes persist after refresh.
- [x] The list visually distinguishes unpaid, partially paid, and paid Invoices.
- [x] Status update errors are visible without losing the current list context.

## Client Data Architecture Requirements

- [x] Invoice payment reads use TanStack Query `useQuery` with stable Invoice query keys.
- [x] Recording or changing payment status uses TanStack Query `useMutation`.
- [x] Successful payment mutations invalidate or update affected Invoice list, Room operations summary, and Dashboard revenue query keys.
- [x] Payment read and write APIs use application services and repository interfaces before reaching the InsForge adapter.
- [x] API responses use the standard success/failure envelope.
- [x] API timing logs identify auth, validation, service, and InsForge write duration.
- [x] A smoke test or behavior test verifies valid payment updates and rejects invalid `amount_paid`/status combinations.

## Implementation notes

- `/invoices` now shows persisted Invoices with a billing-period filter, `amountPaid`, remaining balance, visual status badges, and a payment update Dialog per Invoice.
- Payment updates call `PATCH /api/invoices/[id]/payment` through TanStack Query `useMutation`.
- The mutation updates the Invoice list cache and invalidates Invoice list/payment, Room operations summary, and Dashboard revenue query keys.
- The Dashboard revenue query key is prepared for the Dashboard client-data slice; the current Dashboard UI still uses demo data until issue 07 migrates it.
- `recordInvoicePaymentForOperations` owns the payment rules:
  - `Unpaid` persists `amount_paid = 0`.
  - `Paid` persists `amount_paid = total_amount`.
  - `Partially Paid` requires `0 < amount_paid < total_amount`.
- The InsForge adapter reads the target Invoice total, writes `amount_paid/status`, and returns the updated `InvoiceListItem`.
- Added `src/lib/invoices/payment-service.behavior-smoke.ts` and expanded `src/lib/invoices/api-contract-smoke.ts` for valid payment updates, rejected partial amounts, malformed amount payloads, and the payment API envelope/timing contract.
