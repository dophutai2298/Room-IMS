# 24 — Invoice Table Excel Export

**What to build:** A signed-in operational user can export the invoices table at the invoices page to an Excel file that matches the current table view across all filtered/sorted rows.

**Blocked by:** 06 — Track Invoice Payment Status and Client Data Architecture Requirements; 18 — Upgrade Management Data Tables.

**Status:** ready-for-agent

- [ ] The invoices page shows an "Export Excel" action in the table toolbar.
- [ ] The export action is disabled or explains why it cannot run when the table has no matching rows.
- [ ] The exported workbook includes all rows matching the current table filters/search/sort, not only the current pagination page.
- [ ] The export respects the active billing-period filter.
- [ ] The export respects the active payment-status filter.
- [ ] The export respects the active search text.
- [ ] The export preserves the active row sort order.
- [ ] The export includes only exportable data columns and excludes action columns.
- [ ] The baseline exported columns include invoice code, billing period, room, rent, electricity, water, other fee, other fee note, total amount, amount paid, balance due, and payment status.
- [ ] Money values are exported as numeric values where practical, with clear Vietnamese column labels.
- [ ] The exported filename includes that it is an invoice export plus enough period/filter context to identify it later.
- [ ] Export success and failure states are visible through toast or inline feedback.
- [ ] The implementation introduces a reusable table export seam if the existing table abstraction cannot expose pre-pagination filtered/sorted rows cleanly.
- [ ] Behavior tests cover invoice export row building and "current table view" filtering/sorting behavior.
- [ ] Typecheck, lint, and the existing test suite pass.

## Implementation Notes

- "Theo table" means export what the user is currently looking at after filters/search/sort, across all matching rows.
- Client-side Excel generation from already loaded invoice data is acceptable if it best preserves current table state.
- If a server-side export endpoint is chosen instead, it must receive explicit filter/sort parameters and use normal operational auth.
