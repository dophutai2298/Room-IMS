# 04 — Migrate Utilities, Invoices, Payments, and Exports

**What to build:** Monthly billing works end to end on Supabase: Staff and Landlords record Utility Metrics, Landlords manage Utility Pricing and payments, and authorized users create and review Invoices and export PDF/Excel within their existing permissions. Historical balances and billing rules stay accurate.

**Blocked by:** 03 — Migrate Tenants, CCCD Images, and Contracts.

**Status:** ready-for-agent

- [ ] Import Utility Metrics, effective Utility Pricing and Invoices from the verified source snapshot, preserving IDs, owner/Room/period links, readings, price history, Contract overrides, financial precision, dates, payment status and timestamps. Never regenerate or recalculate historical Invoices during import.
- [ ] Utility Metrics screens and internal APIs can read/save the selected billing period through Supabase, preserving duplicate-period protection, reading validation, permissions, loading/error/saving states and cache invalidation.
- [ ] Utility Pricing list/create/update flows preserve effective dates, Landlord-only changes, owner scope and pricing resolution for past periods. Staff cannot edit pricing.
- [ ] Invoice list/detail/generation/update/payment flows preserve current request/response contracts, formulas, discounts and notes, other fees and notes, status/amount-paid consistency and Staff permissions. Previous unpaid balance is only an editable suggestion for the immediately next period and persists only after Invoice save.
- [ ] PDF detail export and table Excel export return the same authorized financial fields and usable files from Supabase-backed data. Another owner cannot export an Invoice.
- [ ] Verify billing for a month with pricing history, Contract overrides, a partially paid prior Invoice, an existing current Invoice, discount values including 500 VND increments, and duplicate/retry cases. Existing records must not be overwritten by a suggested carry-forward amount.
- [ ] Reconcile exact Utility Metrics/Pricing/Invoice IDs, periods and links, plus decimal-safe totals, amount paid and outstanding balance by Room/owner/period. Explain any difference against ticket 01 before acceptance.
- [ ] Test the complete browser → internal API → Supabase path and direct RLS with Landlord/Staff/unrelated owner accounts. Preserve API errors/timing and query invalidation; no business endpoint in this scope may still require InsForge.
