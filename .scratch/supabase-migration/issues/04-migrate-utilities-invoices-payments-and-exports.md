# 04 — Migrate Utilities, Invoices, Payments, and Exports

**What to build:** Monthly billing works end to end on Supabase: Staff and Landlords record Utility Metrics, Landlords manage Utility Pricing and payments, and authorized users create and review Invoices and export PDF/Excel within their existing permissions. Historical balances and billing rules stay accurate.

**Blocked by:** 03 — Migrate Tenants, CCCD Images, and Contracts.

**Status:** ready-for-human — staged Supabase billing and API/RLS checks pass; manual browser acceptance and upstream tickets remain

- [x] Import Utility Metrics, effective Utility Pricing and Invoices from the verified source snapshot, preserving IDs, owner/Room/period links, readings, price history, Contract overrides, financial precision, dates, payment status and timestamps. Never regenerate or recalculate historical Invoices during import.
- [x] Utility Metrics screens and internal APIs can read/save the selected billing period through Supabase, preserving duplicate-period protection, reading validation, permissions, loading/error/saving states and cache invalidation.
- [x] Utility Pricing list/create/update flows preserve effective dates, Landlord-only changes, owner scope and pricing resolution for past periods. Staff cannot edit pricing. The existing UI update operation is deactivate/supersede, not in-place editing of a historical rate.
- [x] Invoice list/detail/generation/update/payment flows preserve current request/response contracts, formulas, discounts and notes, other fees and notes, status/amount-paid consistency and Staff permissions. Previous unpaid balance is only an editable suggestion for the immediately next period and persists only after Invoice save.
- [x] PDF detail export and table Excel export return the same authorized financial fields and usable files from Supabase-backed data. Another owner cannot export an Invoice. PDF was checked live; Excel generator is covered by existing behavior tests over the `/api/invoices` response.
- [x] Verify billing for a month with pricing history, Contract overrides, a partially paid prior Invoice, an existing current Invoice, discount values including 500 VND increments, and duplicate/retry cases. Existing records must not be overwritten by a suggested carry-forward amount.
- [x] Reconcile exact Utility Metrics/Pricing/Invoice IDs, periods and links, plus decimal-safe totals, amount paid and outstanding balance by Room/owner/period. Explain any difference against ticket 01 before acceptance.
- [ ] Test the complete browser → internal API → Supabase path and direct RLS with Landlord/Staff/unrelated owner accounts. Preserve API errors/timing and query invalidation; no business endpoint in this scope may still require InsForge.

## Implementation evidence — 27 November 2026

Applied billing migrations `202611270002` and `202611270003` to isolated project `udyvtsshkkqbpeqnlcwj`. Snapshot checksums and prerequisites passed; imported and reconciled 101 Utility Metrics, 2 Utility Pricing rows and 101 Invoices across 101 owner/Room/period financial groups. IDs, owner links, readings, prices, Invoice totals, paid amounts, statuses and timestamps matched source without regeneration. The source contains 91 old Invoices with `discount_amount = null`; these were preserved in Supabase rather than silently rewritten to zero. Display treats null as zero.

All billing routes now select the Supabase query adapter when `APP_BACKEND=supabase`; the same UI/TanStack Query paths and API shapes remain. The Room operations-summary endpoint now reads actual Metrics and Invoices on Supabase. A live localhost API probe with temporary confirmed Landlord/Staff/unrelated-owner users passed pricing creation/history, selected-period Metrics save and Staff duplicate denial, Invoice creation with Contract override and 62,500 VND discount, partial payment, next-period debt suggestion and explicit save, PDF download and cross-owner denial. `scripts/verify-supabase-ticket04.ts` passed owner isolation and Staff create-only RLS in a rolled-back transaction. Existing Excel/PDF behavior tests, full automated tests, type-check and production build passed. Probe users/data were cleaned up. See `docs/supabase-billing-migration.md` for guarded commands.

Still required before closing: manually inspect `/rooms/<id>/utilities`, `/utility-pricing`, `/invoices` and downloaded Excel in a real browser using activated accounts; complete ticket 02 SMTP/credential acceptance and ticket 03 gallery acceptance first. Production remains on InsForge by default. Ticket 05 owns the full migration rehearsal.
