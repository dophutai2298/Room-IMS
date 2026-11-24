# 03 — Migrate Tenants, CCCD Images, and Contracts

**What to build:** A signed-in Landlord or Staff member can use existing Tenant and Contract screens with historical data on Supabase. CCCD files, including legacy attachments, remain viewable to authorized users, and the gallery still previews new images and removes old ones only after Save.

**Blocked by:** 02 — Supabase Foundation, Auth, Staff, OTP, and Rooms.

**Status:** ready-for-agent

- [ ] Import Tenants, CCCD image metadata and Contracts from the verified export, preserving primary keys, owner IDs, Room links, Key Tenant links, profiles, amounts, dates, status and relevant timestamps. Imports are repeatable and reject missing/cross-owner references rather than silently dropping records.
- [ ] Existing Tenant directory/detail/create/update/delete, search and Room-associated flows operate through the internal API and Supabase adapters. Preserve role restrictions, owner scoping, validations, query invalidation and loading/error/saving states.
- [ ] Copy and checksum all actual CCCD file bytes from the manifest, including images represented only by legacy front/back URLs. Report any missing objects; re-running the copy does not duplicate gallery records.
- [ ] Store identity documents privately with durable object locators. Adapt non-null legacy public-URL metadata and API gallery responses so stored links do not depend on InsForge or on a persisted expiring signed URL. Existing profiles render after migration.
- [ ] Verify owner- and role-scoped storage read/upload/delete using direct user credentials and the application API; another Landlord, unrelated Staff and anonymous users cannot retrieve a Tenant's documents.
- [ ] Preserve immediate preview after file selection and staged removal of images while editing. Cancellation leaves old objects intact; Save applies new uploads/removals and reports storage failures instead of claiming full success.
- [ ] Existing Contract list/detail/create/update/delete and Room Contract flows work on Supabase. Preserve active Contract and Key Tenant rules, price overrides, deposit/rent fields and Staff create-only permissions.
- [ ] Reconcile Tenant/Contract/image ID sets, counts per owner, relationships and file checksums with ticket 01. Exercise UI, internal API and direct RLS/storage checks with two unrelated Landlords.
