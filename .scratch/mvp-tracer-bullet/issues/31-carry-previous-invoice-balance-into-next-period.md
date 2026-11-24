# 31 — Carry Previous Invoice Balance Into Next Period

**What to build:** When preparing an invoice for a new billing period, carry any unpaid balance from the immediately preceding period into the new invoice's Other Fee field. Show it as an editable form value with the default note “Tiền nợ tháng trước”. Persist the amount and note only when the user creates or updates the new invoice.

**Blocked by:** 05 — Generate Invoices From Utility Metrics; 06 — Track Invoice Payment Status; 08 — Manage Utility Pricing and Other Fee Notes; 29 — Room Utility Billing Workspace Redesign and Discounts. All blockers are done.

**Status:** done

- [x] When the immediately preceding billing period has an unpaid balance, the next period's invoice form pre-fills Other Fee with that outstanding balance.
- [x] The default Other Fee note is “Tiền nợ tháng trước”.
- [x] The user can edit both the carried amount and note before saving.
- [x] Opening the form or editing the pre-filled values does not create or update database records.
- [x] Creating or updating the new period's invoice persists only the current form values and leaves the previous invoice and its payment status unchanged.
- [x] If an invoice already exists for the selected period, its saved Other Fee amount and note take precedence over the carry-forward suggestion and are not silently overwritten.
- [x] If the immediately preceding period has no outstanding balance, no carry-forward amount is added.
- [x] The new invoice total and its PDF/Excel exports include the carried amount through the existing Other Fee line item.
- [x] Tests cover carry-forward from a partially paid invoice, editable draft values, no persistence before submit, existing invoice precedence, and no carry-forward when the prior balance is zero.

## Implementation notes

- Calculate the carry-forward from the prior invoice's current `total_amount - amount_paid`, bounded at zero.
- Use only the immediately preceding billing period; do not aggregate older unpaid invoices unless the product requirement changes.
- Treat carry-forward as a form default. Persist it through the existing invoice generation flow only after explicit submit.
- On an existing invoice, display its saved Other Fee fields to prevent regeneration from adding the same debt again or replacing user edits.

## Implementation summary

- The Utility Metrics screen reads at most two invoices: the selected period and the immediately preceding period, scoped to the same Room and account owner. January correctly uses December of the previous year.
- The response includes Other Fee form defaults. An existing invoice's saved amount and note take precedence, including an explicitly saved zero amount.
- The form keeps editable local values and submits them through the existing invoice mutation. The Other Fee input accepts amounts such as 62,500 VND and the decimal precision supported by the invoice fields.
- Untouched fields adopt refreshed defaults after prior payments or a newly discovered current-period invoice. Once edited, the amount and note remain a local draft across background refreshes until submit; successful saves update cached defaults before clearing the draft.
- Payment changes invalidate the Room's Utility Metrics queries so future invoice defaults can use the latest outstanding balance.
- Existing Other Fee persistence and PDF/Excel exports are reused; no schema change or database migration is required.

## Verification

- Five carry-forward behavior tests cover outstanding debt, year rollover, existing invoice precedence, missing/paid/overpaid/unrelated invoices, and edited values submitted through authenticated invoice HTTP handling and exported through PDF/Excel presenters.
- Two React DOM tests exercise the actual form inputs, refreshed defaults, saved-zero precedence, preservation of user edits, native number validity, and no HTTP requests until submit.
- Full suite: 106 tests passed (104 server behavior tests and 2 form tests). The form suite uses development-only jsdom compatible with the documented Node.js 20 baseline.
- Typecheck, ESLint, and production build passed.
- Standards review: initial duplicated projection resolved; no remaining findings.
- Spec review: stale untouched defaults and missing form-level coverage resolved; no remaining findings.
