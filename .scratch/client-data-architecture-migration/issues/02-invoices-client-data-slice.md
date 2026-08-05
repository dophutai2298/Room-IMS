# 02 — Invoices Client Data Slice

**What to build:** Make the Invoice list feel fast by rendering the Invoice screen shell immediately and loading Invoice data through the new authenticated client data architecture.

**Blocked by:** 01 — Client Data Architecture Foundation; MVP 05 — Generate Invoices From Utility Metrics.

**Status:** done

- [x] Opening the Invoice list shows the page shell and loading state without waiting for all Invoice data.
- [x] Invoice data is loaded through an authenticated app API rather than direct UI access to InsForge.
- [x] The Invoice API uses an application service and repository interface before reaching the InsForge adapter.
- [x] The Invoice list supports loading, empty, error, retry, and success states.
- [x] The Invoice list continues to show the same user-facing Invoice fields and payment status as before.
- [x] Invoice list reads avoid broad unnecessary data where practical.
- [x] API timing logs identify total request time, auth time, service time, and InsForge query time.
- [x] Existing Invoice generation and payment behavior is not changed by this slice.
- [x] A smoke test or behavior test verifies the Invoice list API returns the expected response shape for an authenticated Landlord or Staff user.
