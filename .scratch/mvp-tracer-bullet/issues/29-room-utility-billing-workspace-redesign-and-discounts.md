# 29 — Room Utility Billing Workspace Redesign and Discounts

**What to build:** Redesign the Room Utility Billing workspace so a Landlord or Staff user can comfortably review the selected billing period, record utility metrics, generate or update the invoice, and apply an optional discount with a required note explaining why the discount was given.

**Blocked by:** 04 — Record Monthly Utility Metrics; 05 — Generate Invoices From Utility Metrics; 08 — Manage Utility Pricing and Other Fee Notes; 28 — Account Scoped Data Ownership and Room Floor.

**Status:** done

- [x] The Room Utility Billing page has a clearer responsive layout for mobile, tablet, and desktop, with period selection, utility entry, invoice generation, and invoice summary arranged in a more scannable flow.
- [x] The page avoids horizontal overflow on mobile and tablet, including card content, form controls, invoice detail rows, and any generated invoice summary.
- [x] A user can enter an optional discount amount while generating or updating an invoice for a billing period.
- [x] If the discount amount is greater than zero, the user must enter a discount note explaining the reason for the discount.
- [x] Discount amount and discount note are persisted in InsForge and remain visible after refresh.
- [x] Existing invoices without discount data continue to render safely with a zero discount and empty note.
- [x] Invoice totals subtract the discount after rent, electricity fee, water fee, and other fee have been calculated.
- [x] The generated invoice detail shown in the app clearly displays discount amount and discount note when present.
- [x] Invoice PDF/export logic continues to show correct totals after discount is applied.
- [x] The InsForge migration is safe to run on existing data and does not delete existing invoices.
- [x] Staff and Landlord permissions remain consistent with the current invoice generation/update flow.
- [x] Successful discount changes invalidate or update relevant Utility Metrics, Invoice, Room detail, and Dashboard query keys.
- [x] Loading, empty, validation, saving, success, error, and retry states are visible and follow the current Tailwind/shadcn UI patterns.
- [x] Behavior tests cover invoice generation with no discount, discount with note, rejecting discount without note, and total calculation after discount.
- [x] Typecheck, lint, and the relevant test suite pass.

## Implementation summary

- Added additive InsForge invoice discount columns and applied migration `invoice-discount-fields`.
- Added discount validation, calculation, persistence, app summary, invoice table, PDF, and Excel export support.
- Reworked the utility billing workspace into responsive, overflow-safe cards with clearer period, metric, adjustment, and invoice review sections.

## Implementation notes

- Model discount like the existing other-fee note pattern: numeric amount plus nullable note, with an app-level rule requiring the note only when amount is greater than zero.
- Prefer a small additive schema migration for invoice discount fields so existing rows remain valid.
- Keep the billing calculation auditable: subtotal components should be readable separately from the final total.
- The UI redesign should improve hierarchy without changing the underlying billing workflow: choose period, save readings, generate invoice, review invoice.
