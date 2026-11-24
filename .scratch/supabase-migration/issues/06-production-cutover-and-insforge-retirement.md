# 06 — Production Cutover and InsForge Retirement

**What to build:** Move production to the rehearsed Supabase deployment in a controlled maintenance window, verify that operators can work, establish independent backups, and retire all runtime dependence on hosted InsForge.

**Blocked by:** 05 — Dashboard and Full Migration Rehearsal.

**Status:** ready-for-agent

- [ ] Confirm the approved maintenance window, source availability, target credentials/plan, recovery artifacts, rehearsal evidence, real SMTP delivery and a named go/no-go decision before changing production. Do not proceed with unresolved data or authorization discrepancies.
- [ ] Freeze every source write path: application APIs, account/Staff lifecycle, storage uploads/deletes, import scripts and direct access. Capture and reconcile the final consistent application-data, Auth and file changes against the rehearsal snapshot.
- [ ] Import final deltas idempotently, then verify exact IDs, relationships, owner coverage, Invoice/payment balances and image checksums. There is only one authoritative writer when production reopens.
- [ ] Deploy production with the correct Supabase browser/server/admin configuration and a fresh frontend build where public configuration changed. Require reauthentication, clear obsolete InsForge cookies and account-specific client caches, and confirm existing browser/PWA users can sign in.
- [ ] Before reopening writes, smoke-test Rooms, Staff, Tenant images, Contracts, meters, pricing, Invoice creation/payment, PDF/Excel, Dashboard and recovery email for authorized accounts; confirm unauthorized users remain denied. Record the go-live time and any accepted limitations.
- [ ] Monitor API errors, Auth/SMTP delivery, storage failures, ownership denials, financial reconciliation and comparable latency after reopening. If recovery is required after target writes, freeze and reconcile new payments/documents before any restore or rollback.
- [ ] Establish independent, protected database and file backups with a tested restore path and documented retention/owner. Source-based rollback is available only while InsForge remains reachable; after its Free shutdown, recovery uses verified artifacts or target restoration.
- [ ] Remove runtime InsForge SDK calls, source URLs in required image locators, obsolete environment variables, credentials and provider-only tooling after stabilization. Verify all implemented production workflows with InsForge unavailable; keep protected recovery artifacts and do not delete source business data as a cleanup shortcut.
