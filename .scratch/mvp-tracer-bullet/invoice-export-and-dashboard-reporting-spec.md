Status: ready-for-agent

# Invoice Export and Dashboard Reporting Controls

## Problem Statement

Landlord/Admin and Staff can create invoices, update payment status, and review invoice data in the management system, but the app does not yet provide clean export flows for real operational handoff:

- In invoice detail, there is no downloadable PDF invoice file to send to tenants/customers.
- In the invoices table, there is no Excel export that matches the table view the operator has filtered/searched/sorted.
- In Dashboard, the revenue chart is fixed to a six-month trend, so the operator cannot quickly compare short-term, yearly, two-year, or all-period revenue performance.

These gaps make the app useful for internal tracking but weaker for monthly operations: sending invoices, sharing spreadsheet summaries, and reviewing revenue history.

## Solution

Add reporting/export capabilities in three small vertical slices:

1. Invoice detail PDF export
   - From the invoice detail/monthly utility screen, a signed-in operational user can download a PDF invoice for that room and billing period.
   - The PDF includes the customer-facing invoice breakdown: room, tenant/customer label, period, invoice ID, rent, electricity, water, other fee note, total, amount paid, balance due, and payment status.
   - The PDF file is safe to send to tenants/customers and does not include sensitive internal data such as CCCD images or internal auth metadata.

2. Invoices table Excel export
   - From the invoices list table, a signed-in operational user can export the current table view to an Excel file.
   - "Current table view" means the active period filter, search, status filter, sorting, and visible exportable columns. Pagination should not limit the export; export all rows matching the current table filters.

3. Dashboard revenue chart range controls
   - Dashboard revenue chart adds selectable ranges: 3 months, 6 months, 1 year, 2 years, and all periods.
   - The existing six-month chart remains the default for backwards compatibility.
   - The range only changes the revenue trend chart unless explicitly expanded later; current-period KPI cards and reminders continue to use the selected billing period.

## User Stories

1. As a Landlord/Admin, I want to export a monthly invoice as PDF, so that I can send the file to a tenant/customer.
2. As a Staff user, I want to export a PDF invoice for a billing period, so that I can help with monthly communication without editing old data.
3. As a tenant/customer receiving a PDF invoice, I want to see the room, billing period, and fee breakdown, so that I understand what I need to pay.
4. As a tenant/customer receiving a PDF invoice, I want to see electricity and water charges separated, so that utility fees are transparent.
5. As a tenant/customer receiving a PDF invoice, I want to see the note for "other fee", so that I understand what the extra fee is for.
6. As a tenant/customer receiving a PDF invoice, I want to see total amount, amount paid, and balance due, so that the payment status is clear.
7. As a Landlord/Admin, I want the PDF filename to include invoice/room/period information, so that downloaded files are easy to organize.
8. As a user exporting PDF, I want clear feedback if the invoice does not exist yet, so that I know I must generate the invoice first.
9. As a user exporting PDF, I want the PDF to avoid sensitive tenant identity documents, so that I do not accidentally share private internal data.
10. As a Landlord/Admin, I want to export the invoices table to Excel, so that I can send or archive monthly invoice summaries.
11. As a Staff user, I want to export invoice table data to Excel, so that I can support reporting without needing database access.
12. As a user filtering the invoices table, I want export to respect the selected period filter, so that the spreadsheet matches what I am reviewing.
13. As a user searching the invoices table, I want export to respect search results, so that I can export only the relevant rows.
14. As a user sorting the invoices table, I want export to preserve row order, so that the spreadsheet matches the table order.
15. As a user hiding table columns, I want export to avoid hidden/action columns, so that the spreadsheet is clean.
16. As a user exporting Excel with no matching rows, I want a clear disabled state or message, so that I do not download an empty surprise file.
17. As a Landlord/Admin, I want the Dashboard chart to switch between 3 months, 6 months, 1 year, 2 years, and all periods, so that I can quickly inspect different time windows.
18. As a Staff user, I want the Dashboard chart range selector to be easy to understand, so that I can use it during monthly operations.
19. As a user opening Dashboard, I want the existing six-month chart to remain the default, so that current behavior is preserved.
20. As a user selecting "all periods", I want the chart to include every billing period with invoice data, so that I can review full historical revenue.
21. As a user selecting a chart range, I want the URL/query state or query cache to reflect the range, so that reloads and cache invalidation behave predictably.
22. As a developer, I want export and chart APIs to use existing auth, service, repository, presenter, timing, and TanStack Query conventions, so that these additions fit the architecture.
23. As a developer, I want behavior tests around PDF view building, Excel row export, and revenue range calculation, so that reporting changes do not silently regress.

## Implementation Decisions

- PDF export should be produced from the app boundary, not by asking users to use browser print. A server-owned export endpoint is preferred because it can fetch a trusted invoice snapshot, enforce auth, return `application/pdf`, and produce consistent output.
- PDF export is a read operation. Both Landlord/Admin and active Staff can download invoices through the normal operational auth policy.
- The PDF should be generated from an invoice export view/model that is independent from UI components. This model should combine invoice, room, key tenant/customer name, billing period, utility readings when available, fee line items, payment status, and customer-safe metadata.
- The PDF should include customer-facing fields only. Do not include CCCD numbers/images, internal app-user IDs, auth tokens, or debug/timing metadata inside the PDF content.
- The PDF download action should appear on the invoice detail/monthly utility screen when an invoice exists for the selected room and billing period. If no invoice exists, the UI should show a disabled state or a message that the invoice must be generated first.
- PDF filenames should be deterministic and readable, for example using invoice code, room name, and billing period.
- Excel export from the invoices page should export the current table view across all matching filtered/sorted rows, not only the current pagination page.
- Excel export should use exportable data columns, not action columns. The baseline columns should include invoice code, billing period, room, rent, electricity, water, other fee, other fee note, total amount, amount paid, balance due, and payment status.
- Excel numeric money values should remain numbers in the workbook where practical, while labels/statuses should use the same Vietnamese display language as the UI.
- Excel export can be implemented client-side from already loaded table data if that gives the most accurate "what the user sees" behavior. If a server export endpoint is chosen later, it must receive explicit filter/sort parameters and still use operational auth.
- The DataTable abstraction may need a small export seam that exposes pre-pagination filtered/sorted rows to toolbar actions. Keep that seam generic so future Rooms/Tenants/Contracts exports can reuse it.
- Dashboard revenue chart range should be represented as a small product enum: 3 months, 6 months, 1 year, 2 years, all periods.
- The six-month range remains default.
- Dashboard revenue API/query keys should include the selected revenue range so cached chart responses do not collide.
- Fixed month ranges should return contiguous monthly buckets with zero values where no invoice exists.
- "All periods" should include the full invoice history needed for the chart. Prefer a contiguous monthly range from the earliest invoice period through the current/selected billing period or latest invoice period, whichever best matches the existing dashboard period semantics.
- Changing the chart range should not change current-period KPI cards, unpaid invoice reminders, or missing utility metric reminders unless a later ticket explicitly expands those controls.
- Export and dashboard changes should preserve the client-data architecture: UI calls app APIs through shared fetch helpers where server data is needed, and uses TanStack Query for server reads/mutations.

## Testing Decisions

- Test the highest stable seams available:
  - invoice export view/model builder,
  - invoice PDF HTTP/export boundary,
  - invoice table export row builder,
  - generic table export seam if added,
  - dashboard revenue range normalization and presenter output,
  - dashboard revenue HTTP contract.
- Tests should assert external behavior and generated export data, not private implementation details of a PDF or Excel library.
- PDF tests should verify the customer-facing invoice fields are present in the export view and that sensitive fields are absent.
- Excel tests should verify exported rows respect table-like filtering/sorting decisions and include the expected headers/values.
- Dashboard tests should verify 3-month, 6-month, 1-year, 2-year, and all-period ranges; fixed ranges should include zero-filled missing months.
- API contract/smoke tests should preserve the existing app API response, error, auth, and timing shape where applicable.
- Full verification should include typecheck, lint, and existing behavior test suite.

## Out of Scope

- Online payment processing.
- Sending the PDF email automatically from the app.
- E-signatures, tax/VAT invoice compliance, or government e-invoice integration.
- A customizable invoice template editor.
- Multi-language invoice templates.
- Bulk PDF export for many invoices at once.
- Exporting Rooms/Tenants/Contracts tables to Excel in this ticket set.
- Changing how invoice payment status is recorded.
- Changing the Dashboard billing period selector beyond the revenue chart range.

## Further Notes

- The current invoices list already supports TanStack Query, search, status filter, period filter, sorting, pagination, and column visibility. Excel export should build on that table behavior instead of reimplementing a parallel filter system.
- The current Dashboard revenue chart uses Recharts and hardcodes a six-month trend. The range selector should change chart data length/coverage, not replace the chart library.
- The current invoice "detail" path is the room utility/billing period screen. If a dedicated invoice detail route is introduced in the future, the same PDF export behavior should be available there too.
- Recommended ticket split: one ticket for invoice PDF, one for invoices Excel export, and one for Dashboard chart range controls. These are independent and can be implemented in parallel after their existing invoice/dashboard foundations are complete.
