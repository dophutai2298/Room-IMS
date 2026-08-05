# 02 — Invoices Client Data Slice

**What to build:** Make the Invoice list feel fast by rendering the Invoice screen shell immediately and loading Invoice data through the new authenticated client data architecture.

**Blocked by:** 01 — Client Data Architecture Foundation; MVP 05 — Generate Invoices From Utility Metrics.

**Status:** ready-for-agent

- [ ] Opening the Invoice list shows the page shell and loading state without waiting for all Invoice data.
- [ ] Invoice data is loaded through an authenticated app API rather than direct UI access to InsForge.
- [ ] The Invoice API uses an application service and repository interface before reaching the InsForge adapter.
- [ ] The Invoice list supports loading, empty, error, retry, and success states.
- [ ] The Invoice list continues to show the same user-facing Invoice fields and payment status as before.
- [ ] Invoice list reads avoid broad unnecessary data where practical.
- [ ] API timing logs identify total request time, auth time, service time, and InsForge query time.
- [ ] Existing Invoice generation and payment behavior is not changed by this slice.
- [ ] A smoke test or behavior test verifies the Invoice list API returns the expected response shape for an authenticated Landlord or Staff user.
