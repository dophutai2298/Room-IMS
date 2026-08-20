# 23 — Invoice Detail PDF Export

**What to build:** A signed-in operational user can download a customer-safe PDF invoice for a selected room and billing period from the invoice detail/monthly utility screen, then send that PDF to the tenant/customer.

**Blocked by:** 05 — Generate Invoices From Utility Metrics; 06 — Track Invoice Payment Status and Client Data Architecture Requirements; 08 — Manage Utility Pricing and Other Fee Notes.

**Status:** done

- [x] The invoice detail/monthly utility screen shows a clear "Export PDF" or "Tải PDF" action when an invoice exists for the selected billing period.
- [x] If no invoice exists for the selected billing period, the UI explains that the invoice must be generated before PDF export.
- [x] PDF export is protected by normal operational auth and allows active Landlord/Admin and active Staff as a read operation.
- [x] The export endpoint returns a PDF response with the correct content type and a readable deterministic filename.
- [x] The PDF includes invoice code, room name, billing period, tenant/customer name when available, generated/export date, and payment status.
- [x] The PDF includes separate line items for room rent, electricity, water, and other fees.
- [x] The PDF includes utility reading/consumption details when those values are available for the billing period.
- [x] The PDF includes the other-fee note when an other fee is present.
- [x] The PDF includes total amount, amount paid, and balance due.
- [x] The PDF excludes sensitive internal data such as auth IDs, timing metadata, CCCD numbers, and CCCD images.
- [x] Invalid invoice/room/period targets return the standard not-found or validation error shape.
- [x] Export failures show a recoverable UI error state and do not break the invoice detail screen.
- [x] Behavior tests cover invoice export view building, missing invoice handling, sensitive-field exclusion, and the HTTP export boundary.
- [x] Typecheck, lint, and the existing test suite pass.

## Implementation Notes

- Prefer a server-owned PDF export endpoint so the generated file is stable and customer-safe.
- Build the PDF from an invoice export view/model, not directly from UI markup.
- See the invoice export and dashboard reporting spec for the full customer-facing field list.

## Agent Notes

- Added authenticated `GET /api/rooms/[id]/invoices/pdf?month=&year=` for active Landlord and Staff read access.
- Added a customer-safe invoice export view that explicitly excludes CCCD/auth/timing fields.
- Added InsForge reads for Invoice, Room, Utility Metrics, and the billing-period Contract with nested Key Tenant name; the independent reads run in parallel.
- Added Vietnamese PDF generation with embedded Geist fonts, deterministic filenames, fee/readings/payment breakdowns, and page continuation for unrestricted other-fee notes.
- Added a PDF-specific VND formatter that uses the Geist-supported `đ` suffix instead of the unsupported U+20AB `₫` glyph, with a regression test against the actual embedded font.
- Added a `useMutation` download action with disabled/no-invoice, pending, success, error, and retry states on the monthly utility screen.
- Added behavior coverage for view building, sensitive-field exclusion, missing invoices, HTTP headers/filename, Landlord/Staff auth, invalid targets, standard 404 mapping, valid PDF output, and long-note pagination.
- Verification passed: `npx.cmd tsc --noEmit`, `npm.cmd run lint`, `npm.cmd test` (63/63), `npm.cmd run build`, and `git diff --check`.
