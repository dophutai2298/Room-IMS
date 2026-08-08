# 08 — Manage Utility Pricing and Other Fee Notes

**What to build:** Let a Landlord manage global Utility Pricing from the app UI and capture a note whenever an Invoice includes other fees, so electricity/water prices and ad-hoc charges are auditable without editing InsForge data manually.

**Blocked by:** 05 — Generate Invoices From Utility Metrics.

**Status:** Done

- [x] A Landlord can open a Utility Pricing management screen from the app navigation or an appropriate settings entry point.
- [x] The Utility Pricing screen lists persisted active and historical pricing rows from InsForge.
- [x] A Landlord can create a new global Utility Pricing row with `effective_from`, electricity unit price, and water unit price.
- [x] The app validates Utility Pricing inputs: prices must be non-negative numbers, and `effective_from` is required.
- [x] The app can deactivate or supersede an older global Utility Pricing row without deleting billing history.
- [x] Invoice generation continues to use Contract-level electricity/water overrides when present; otherwise it uses the applicable global Utility Pricing row.
- [x] The Invoice generation form includes an optional note field whenever `other_fee` is entered.
- [x] If `other_fee` is greater than 0, the note is required and explains what the extra charge is for.
- [x] The other fee note is persisted with the Invoice and remains visible after refresh.
- [x] The Invoice list or detail view displays the other fee note when an Invoice has other fees.
- [x] Existing Invoices without an other fee note continue to render safely.
- [x] Success, validation, and failure states use the existing Tailwind/shadcn and Sonner feedback patterns.

## Client Data Architecture Requirements

Folded in from `client-data-architecture-migration/issues/05-utility-pricing-client-data-slice.md`.

- [x] Utility Pricing reads use TanStack Query `useQuery` with stable pricing query keys.
- [x] Utility Pricing writes use TanStack Query `useMutation`.
- [x] Successful writes invalidate or update Utility Pricing and dependent Invoice-generation query keys.
- [x] A Landlord can load active and historical Utility Pricing rows through an authenticated app API.
- [x] Creating or superseding Utility Pricing uses an application service and repository interface before reaching the InsForge adapter.
- [x] The UI supports loading, empty, validation, saving, success, error, and retry states.
- [x] Utility Pricing validation still requires an effective date and non-negative electricity and water prices.
- [x] Historical pricing is preserved when a new active pricing row is created.
- [x] Invoice generation can continue to resolve applicable Utility Pricing after the migration.
- [x] API timing logs identify pricing read and write duration.
- [x] A smoke test or behavior test verifies Utility Pricing read and create behavior for an authenticated Landlord.

## Implementation summary

- Added `/utility-pricing` as a client-data page using `useQuery` and `useMutation`.
- Added `GET/POST /api/utility-pricing` and `PATCH /api/utility-pricing/[id]`.
- Added `utility-pricing` service/repository contracts and an InsForge adapter for list/create/deactivate.
- Added nullable `invoices.other_fee_note` in `schema.sql` and a migration.
- Invoice generation now requires a note when `other_fee > 0` and persists the note.
- Invoice list and the room utility invoice card display the other fee note safely.
- Invoice pricing lookup now reads historical pricing rows instead of filtering only active rows.
- Added Utility Pricing API contract smoke and service behavior smoke files.

## Implementation notes

- Current schema already has `utility_pricing` with `effective_from`, `electricity_unit_price`, `water_unit_price`, and `is_active`, but the app has no UI for managing it yet.
- Current Invoice generation only stores `other_fee` as a numeric value. Add a persisted text field such as `other_fee_note` or a small charge-line model before requiring the UI note.
- Prefer a small schema migration that preserves existing Invoice rows by allowing `other_fee_note` to be nullable. The app-level rule should require the note only when `other_fee > 0`.
- Keep the MVP simple: one global pricing timeline is enough. Per-Contract overrides already exist on `contracts` and should remain the higher-priority source during invoice generation.
