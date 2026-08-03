# 05 — Generate Invoices From Utility Metrics

**What to build:** Generate or update a monthly Invoice from a Room's active Contract, persisted Utility Metrics, applicable Utility Pricing, and optional other fees. The flow should be idempotent per Room and billing period so repeated generation does not create duplicates.

**Blocked by:** 04 — Record Monthly Utility Metrics.

**Status:** ready-for-agent

- [ ] An Invoice can be generated after valid Utility Metrics are saved.
- [ ] Electricity fee equals electricity consumption multiplied by the applicable electricity price.
- [ ] Water fee equals water consumption multiplied by the applicable water price.
- [ ] Contract-level Utility Pricing overrides are used when present; otherwise global Utility Pricing is used.
- [ ] Total amount equals base rent plus electricity fee plus water fee plus other fees.
- [ ] A newly generated Invoice starts unpaid with `amount_paid = 0`.
- [ ] Invoice generation is idempotent for the same Room and billing period.
- [ ] Generated Invoices appear in the Invoice list.
- [ ] Generation success and failure states are shown with the redesigned UI feedback system.
