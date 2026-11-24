# 01 — Rescue InsForge Data and Inventory

**What to build:** Give the Landlord a verified, independently restorable snapshot of the live InsForge application before the Free project stops. The snapshot covers application records, Auth identities and state, actual CCCD image bytes, and the metadata needed to reconnect them. This ticket is complete when the export can be restored in isolation and its gaps are reported.

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] Inventory the live source and reconcile it with the application's eight expected tables: `app_users`, `rooms`, `tenants`, `tenant_cccd_images`, `contracts`, `utility_metrics`, `utility_pricing`, and `invoices`. Record schema version, indexes, constraints, RLS/functions, database access, Auth users and storage resources; flag anything additional or missing.
- [ ] Export the application schema and every application row through a supported read-only route. Use a direct database export when available, or complete paginated extraction with retries and proof that no page or owner was omitted. Do not restore provider-managed system schemas into another provider.
- [ ] Export Auth identity, verified/disabled state and a source-to-application-user mapping through an authorized method. Record whether password hashes are exportable, their format, and whether a secure transfer is realistically testable; absence of hashes does not block the other backups.
- [ ] Download the actual bytes of all CCCD images, including legacy front/back URLs and multi-image records. Produce a manifest of source locator, Tenant, owner, MIME type, size, checksum and any failed download.
- [ ] Produce a dated, protected snapshot manifest with exact ID sets, row counts by table and owner, foreign-key relationships, and decimal-safe Invoice/payment totals by owner and billing period. Report missing images, orphan records and inconsistencies explicitly.
- [ ] Prove that the database export and file archive can be read and restored in an isolated environment and that counts/checksums match the manifest. Preserve a documented recovery procedure and a clear go/no-go report for migration.
- [ ] Keep backups, hashes, images, tokens and connection credentials out of the repository and logs; restrict access and encrypt sensitive artifacts. Source production data remains unchanged.
- [ ] Prioritize this ticket before **December 7, 2026**, the Free shutdown date stated in the user's InsForge email. Record any source-access blocker immediately so the backup path can be adjusted while the project is still reachable.
