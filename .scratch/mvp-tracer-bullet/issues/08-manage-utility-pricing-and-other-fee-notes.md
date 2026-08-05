# 08 — Manage Utility Pricing and Other Fee Notes

**What to build:** Let a Landlord manage global Utility Pricing from the app UI and capture a note whenever an Invoice includes other fees, so electricity/water prices and ad-hoc charges are auditable without editing InsForge data manually.

**Blocked by:** 05 — Generate Invoices From Utility Metrics.

**Status:** ready-for-agent

- [ ] A Landlord can open a Utility Pricing management screen from the app navigation or an appropriate settings entry point.
- [ ] The Utility Pricing screen lists persisted active and historical pricing rows from InsForge.
- [ ] A Landlord can create a new global Utility Pricing row with `effective_from`, electricity unit price, and water unit price.
- [ ] The app validates Utility Pricing inputs: prices must be non-negative numbers, and `effective_from` is required.
- [ ] The app can deactivate or supersede an older global Utility Pricing row without deleting billing history.
- [ ] Invoice generation continues to use Contract-level electricity/water overrides when present; otherwise it uses the applicable global Utility Pricing row.
- [ ] The Invoice generation form includes an optional note field whenever `other_fee` is entered.
- [ ] If `other_fee` is greater than 0, the note is required and explains what the extra charge is for.
- [ ] The other fee note is persisted with the Invoice and remains visible after refresh.
- [ ] The Invoice list or detail view displays the other fee note when an Invoice has other fees.
- [ ] Existing Invoices without an other fee note continue to render safely.
- [ ] Success, validation, and failure states use the existing Tailwind/shadcn and Sonner feedback patterns.

## Client Data Architecture Requirements

Folded in from `client-data-architecture-migration/issues/05-utility-pricing-client-data-slice.md`.

- [ ] Utility Pricing reads use TanStack Query `useQuery` with stable pricing query keys.
- [ ] Utility Pricing writes use TanStack Query `useMutation`.
- [ ] Successful writes invalidate or update Utility Pricing and dependent Invoice-generation query keys.
- [ ] A Landlord can load active and historical Utility Pricing rows through an authenticated app API.
- [ ] Creating or superseding Utility Pricing uses an application service and repository interface before reaching the InsForge adapter.
- [ ] The UI supports loading, empty, validation, saving, success, error, and retry states.
- [ ] Utility Pricing validation still requires an effective date and non-negative electricity and water prices.
- [ ] Historical pricing is preserved when a new active pricing row is created.
- [ ] Invoice generation can continue to resolve applicable Utility Pricing after the migration.
- [ ] API timing logs identify pricing read and write duration.
- [ ] A smoke test or behavior test verifies Utility Pricing read and create behavior for an authenticated Landlord.

## Implementation notes

- Current schema already has `utility_pricing` with `effective_from`, `electricity_unit_price`, `water_unit_price`, and `is_active`, but the app has no UI for managing it yet.
- Current Invoice generation only stores `other_fee` as a numeric value. Add a persisted text field such as `other_fee_note` or a small charge-line model before requiring the UI note.
- Prefer a small schema migration that preserves existing Invoice rows by allowing `other_fee_note` to be nullable. The app-level rule should require the note only when `other_fee > 0`.
- Keep the MVP simple: one global pricing timeline is enough. Per-Contract overrides already exist on `contracts` and should remain the higher-priority source during invoice generation.
