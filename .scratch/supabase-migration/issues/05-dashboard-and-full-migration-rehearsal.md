# 05 — Dashboard and Full Migration Rehearsal

**What to build:** The Supabase-backed Dashboard shows accurate availability, reminders and revenue for each owner. The whole migration can then be repeated in isolation, measured, reconciled and recovered before production cutover.

**Blocked by:** 02 — Supabase Foundation, Auth, Staff, OTP, and Rooms; 03 — Migrate Tenants, CCCD Images, and Contracts; 04 — Migrate Utilities, Invoices, Payments, and Exports.

**Status:** ready-for-agent

- [ ] Dashboard room availability, missing-meter reminders, unpaid-Invoice reminders, operations summary and revenue chart use Supabase-backed internal APIs. Preserve selected month, current-year and other chart ranges, Brush behavior, owner scope, loading/error/retry and query invalidation.
- [ ] Reconcile Dashboard counts and revenue against the migrated Rooms, Contracts, Utility Metrics and Invoices for at least two owners and multiple billing periods, including an empty new account and partial payments.
- [ ] Run a complete isolated migration rehearsal from the protected export through Auth mapping, application data and file bytes. Record steps, durations, expected downtime, retries, and unresolved source gaps; rehearsal must not alter production source or email all real users.
- [ ] Produce automated reconciliation evidence for exact ID sets, row counts by owner, foreign keys, per-period financial values and every image checksum/locator. A successful import with silent dropped rows is a failure.
- [ ] Verify real Supabase integration through internal `/api`, browser sign-in/OTP, Staff lifecycle, CCCD upload/display/deferred delete, Contract and billing/payment flows, PDF/Excel, Dashboard and mobile/PWA reauthentication.
- [ ] Test RLS and private Storage directly with user credentials for two unrelated Landlords, owned Staff, a disabled user and an empty new Landlord. Confirm no unauthorized cross-owner reads, writes or image access and no service-key bypass in operational paths.
- [ ] Compare warm p50/p95 latency for representative list/detail, Dashboard and payment requests against the existing source baseline, noting region, sample size, payload and cold-start effects. Preserve safe Auth → Service → Repository → provider timing without logging secrets or document contents.
- [ ] Rehearse recovery before and after target writes, including source unavailable. Document how to preserve new payments/documents, validated backup restores, and a concrete go/no-go result for production cutover.
