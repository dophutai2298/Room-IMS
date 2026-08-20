# 24 — Invoice Table Excel Export

**What to build:** A signed-in operational user can export the invoices table at the invoices page to an Excel file that matches the current table view across all filtered/sorted rows.

**Blocked by:** 06 — Track Invoice Payment Status and Client Data Architecture Requirements; 18 — Upgrade Management Data Tables.

**Status:** done

- [x] The invoices page shows an "Export Excel" action in the table toolbar.
- [x] The export action is disabled or explains why it cannot run when the table has no matching rows.
- [x] The exported workbook includes all rows matching the current table filters/search/sort, not only the current pagination page.
- [x] The export respects the active billing-period filter.
- [x] The export respects the active payment-status filter.
- [x] The export respects the active search text.
- [x] The export preserves the active row sort order.
- [x] The export includes only exportable data columns and excludes action columns.
- [x] The baseline exported columns include invoice code, billing period, room, rent, electricity, water, other fee, other fee note, total amount, amount paid, balance due, and payment status.
- [x] Money values are exported as numeric values where practical, with clear Vietnamese column labels.
- [x] The exported filename includes that it is an invoice export plus enough period/filter context to identify it later.
- [x] Export success and failure states are visible through toast or inline feedback.
- [x] The implementation introduces a reusable table export seam if the existing table abstraction cannot expose pre-pagination filtered/sorted rows cleanly.
- [x] Behavior tests cover invoice export row building and "current table view" filtering/sorting behavior.
- [x] Typecheck, lint, and the existing test suite pass.

## Implementation Notes

- "Theo table" means export what the user is currently looking at after filters/search/sort, across all matching rows.
- Client-side Excel generation from already loaded invoice data is acceptable if it best preserves current table state.
- If a server-side export endpoint is chosen instead, it must receive explicit filter/sort parameters and use normal operational auth.

## Agent Notes

- Added a reusable `DataTable` current-view seam exposing filtered and sorted rows before pagination.
- Added browser-side `.xlsx` generation with lazy-loaded `write-excel-file`; no additional API or InsForge request is made.
- Export includes the twelve specified Vietnamese columns, preserves money as numeric cells, freezes the header row, and excludes row actions.
- Filename records the active billing period, payment status, optional search context, and export date.
- Added disabled, pending, success-toast, and error-toast states using a mutation snapshot for each export attempt.
- Behavior coverage verifies export rows/filename and pre-pagination filter/sort ordering.
- Verification passed: `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd test` (65/65), `npm.cmd run build`, and `git diff --check`.
