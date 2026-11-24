# 01 — Rescue InsForge Data and Inventory

**What to build:** Give the Landlord a verified, independently restorable snapshot of the live InsForge application before the Free project stops. The snapshot covers application records, Auth identities and state, actual CCCD image bytes, and the metadata needed to reconnect them. This ticket is complete when the export can be restored in isolation and its gaps are reported.

**Blocked by:** None — can start immediately.

**Status:** human-review — backup and isolated restore verified; source-data gaps below need migration decision

- [x] Inventory the live source and reconcile it with the application's eight expected tables: `app_users`, `rooms`, `tenants`, `tenant_cccd_images`, `contracts`, `utility_metrics`, `utility_pricing`, and `invoices`. Record schema version, indexes, constraints, RLS/functions, database access, Auth users and storage resources; flag anything additional or missing.
- [x] Export the application schema and every application row through a supported read-only route. Use a direct database export when available, or complete paginated extraction with retries and proof that no page or owner was omitted. Do not restore provider-managed system schemas into another provider.
- [ ] Export Auth identity, verified/disabled state and a source-to-application-user mapping through an authorized method. Record whether password hashes are exportable, their format, and whether a secure transfer is realistically testable; absence of hashes does not block the other backups. **Partial:** identity, email verification and mapping exported; disabled state/hashes unavailable through the authorized API.
- [x] Download the actual bytes of all CCCD images, including legacy front/back URLs and multi-image records. Produce a manifest of source locator, Tenant, owner, MIME type, size, checksum and any failed download.
- [x] Produce a dated, protected snapshot manifest with exact ID sets, row counts by table and owner, foreign-key relationships, and decimal-safe Invoice/payment totals by owner and billing period. Report missing images, orphan records and inconsistencies explicitly.
- [x] Prove that the database export and file archive can be read and restored in an isolated environment and that counts/checksums match the manifest. Preserve a documented recovery procedure and a clear go/no-go report for migration.
- [x] Keep backups, hashes, images, tokens and connection credentials out of the repository and logs; restrict access and encrypt sensitive artifacts. Source production data remains unchanged.
- [x] Prioritize this ticket before **December 7, 2026**, the Free shutdown date stated in the user's InsForge email. Record any source-access blocker immediately so the backup path can be adjusted while the project is still reachable.

## Rescue evidence — 24 November 2026

- Encrypted, authenticated snapshot: `.scratch/insforge-rescue/insforge-2026-11-24T12-47-39-363Z.enc` (ignored by Git). The owner must copy this file to independent secure storage and retain the private passphrase separately. Runbook: `docs/insforge-rescue.md`.
- Exact table rows: `app_users` 2; `rooms` 4; `tenants` 10; `tenant_cccd_images` 0; `contracts` 10; `utility_metrics` 101; `utility_pricing` 2; `invoices` 101. Paginated REST ID sets, per-owner counts and SQL restore ID sets match. Source has 10 migration records; admin export contains eight table definitions, 14 indexes, 30 RLS policies and four functions. Full database catalog, exact PostgreSQL version/extensions and provider-managed system schemas were inaccessible through the available admin API; no claim of completeness for those.
- Auth API returned two users; both map to `app_users`, and both expose verified email state. The API does **not** expose disabled state or password hashes, so these cannot be transferred or verified by this route. `app_users.status` is backed up. Plan password-reset/re-enrolment on Supabase.
- Storage API listed one **public** `tenant-cccd-images` bucket and five downloadable objects. All five original byte streams and SHA-256 values passed archive and extracted-file verification. No legacy front/back URLs were populated. The source contains zero `tenant_cccd_images` rows; no object key starts with an existing Tenant ID. Tenant/owner linkage in the per-file manifest is explicitly `null` for all five files, not inferred. Do not auto-attach them during import.
- Invoice sums after PostgreSQL 16 restore: total `384,854,500.00`, paid `368,288,500.00`, outstanding `16,566,000.00` VND; all 26 owner/period groups matched exact decimal-safe manifest totals. Every restored row/field, all eight table ID sets, per-owner row counts and five file checksums matched using `scripts/verify-insforge-restore.ts`.
- InsForge's raw SQL export was not directly restorable: it omitted primary keys and emitted policies/triggers before required functions, including duplicate Contract trigger declarations. The drill used a documented, disposable bootstrap and derived SQL with known `id` primary keys. This proves record restoration, **not** full source-schema equivalence. Supabase migrations must reconstruct and review constraints, Auth/RLS and Storage separately.
- **Go/no-go:** GO for beginning ticket 02 with this protected backup and documented gaps. NO-GO for production cutover until the archive has an independent copy, five unlinked CCCD files have an explicit quarantine/ownership decision, Auth re-enrolment is tested, and a frozen final snapshot is reconciled. The source was only read; no production mutation was performed.

**Owner action still open:** copy the latest `.enc` to another trusted storage location and verify that the passphrase is available separately. No independent destination was supplied to the agent, so this copy was not performed.

- [ ] Owner has confirmed the independent encrypted copy and separate passphrase access before relying on this as the sole recovery point.
