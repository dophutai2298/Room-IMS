# 05 — Generate Invoices From Utility Metrics

**What to build:** Generate or update a monthly Invoice from a Room's active Contract, persisted Utility Metrics, applicable Utility Pricing, and optional other fees. The flow should be idempotent per Room and billing period so repeated generation does not create duplicates.

**Blocked by:** 04 — Record Monthly Utility Metrics.

**Status:** human-review

**MVP business scope:** done.

**Client Data Architecture follow-up:** pending under ticket 08 for Utility Pricing and other-fee notes, and under ticket 04 for Utility Metrics API migration.

- [x] An Invoice can be generated after valid Utility Metrics are saved.
- [x] Electricity fee equals electricity consumption multiplied by the applicable electricity price.
- [x] Water fee equals water consumption multiplied by the applicable water price.
- [x] Contract-level Utility Pricing overrides are used when present; otherwise global Utility Pricing is used.
- [x] Total amount equals base rent plus electricity fee plus water fee plus other fees.
- [x] A newly generated Invoice starts unpaid with `amount_paid = 0`.
- [x] Invoice generation is idempotent for the same Room and billing period.
- [x] Generated Invoices appear in the Invoice list.
- [x] Generation success and failure states are shown with the redesigned UI feedback system.

## Implementation notes

- `/rooms/[id]/utilities` now shows an invoice generation form after the Utility Metrics form. The submit button is enabled only when the selected period has persisted Utility Metrics and the Room has an active Contract.
- Invoice generation reads Room, active Contract, Utility Metrics, global Utility Pricing, and an existing Invoice for the same `(room_id, month, year)` from InsForge. The selected Contract must overlap the billing period using `start_date`/`end_date`.
- Electricity and water fees are calculated from consumption and unit price. Contract overrides win over global Utility Pricing; global pricing uses the latest active price with `effective_from` on or before the selected billing period, falling back to the earliest active price when no historical pricing exists yet.
- New invoices are inserted with `amount_paid = 0` and `status = 'Unpaid'`. Existing invoices are updated in place and preserve already-collected payment amounts within the new total.
- `/invoices` now reads persisted Invoices from InsForge instead of `demo-data`, so generated invoices appear in the list after revalidation/refresh.
- Generation success/failure feedback is shown inline and through the existing Sonner toaster configured in the app layout.

## Client Data Architecture Notes

- Invoice list client-data migration is already completed in the former client-data tracker issue 02 and implemented through `/api/invoices`.
- Room detail client-data migration is already completed in the former client-data tracker issue 03 and implemented through Room detail and operations-summary APIs.
- Keep Invoice generation behavior unchanged while later tickets migrate Utility Metrics, Utility Pricing, payment status, and dashboard reads/writes to TanStack Query + app API routes.
