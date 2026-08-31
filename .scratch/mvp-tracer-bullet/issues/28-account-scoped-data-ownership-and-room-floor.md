# 28 — Account-Scoped Data Ownership and Room Floor

**What to build:** Room records can store which floor they belong to, and all business data becomes scoped to the signed-in account/workspace owner so each account only sees the data it owns. Existing imported/seeded business data is backfilled to the intended current owner account, while a brand-new account starts with an empty system until it creates its own rooms, tenants, contracts, utility readings, pricing, invoices, and related records.

**Blocked by:** 02 — Set Up InsForge DB, Authentication, and API Foundation; 03 — Persist Room, Tenant, and Contract Data; 04 — Record Monthly Utility Metrics; 05 — Generate Invoices From Utility Metrics; 06 — Track Invoice Payment Status; 08 — Manage Utility Pricing and Other Fee Notes; 09 — Tenants Client Data Management; 10 — Contracts Client Data Management; 11 — Auth Staff Management Client Data; 12 — Rooms Client Data and Management

**Status:** done

- [x] Room has a `floor` field in the data model, create/update flows, list/detail views, validation, API responses, and imported/seeded data.
- [x] Business tables are owned by an account/workspace owner through an owner reference that supports one owner account to many business records.
- [x] Existing business data can be safely migrated/backfilled to the selected current owner account, for example `64bf8559-acb2-444c-82ae-197fc452c743` and `b8f0ad0e-a0ee-4dea-9895-3eda37d3d1b1` when that is the intended owner.
  - Backfilled current InsForge business rows to owner `c4a200d3-9311-411b-a1a5-635aa42b0b2a`.
- [x] A newly created owner account sees no rooms, tenants, contracts, utility metrics, utility pricing, invoices, dashboard totals, or reminders until it creates its own data.
- [x] All read APIs filter by the resolved signed-in owner scope before returning business data.
- [x] All create APIs set the owner field server-side from the resolved auth context; client payloads cannot spoof or override ownership.
- [x] All update/delete APIs verify the target record belongs to the resolved owner scope before allowing the mutation.
- [x] Staff accounts continue to follow role permissions while reading/creating data only inside their assigned owner scope; they cannot access another owner account's data.
- [x] Derived data keeps ownership consistent: generated invoices inherit owner scope from the room/utility period, tenant image records inherit from their tenant, and dashboard aggregates only use rows from the current owner scope.
- [x] React Query cache is cleared on sign-out; owner isolation is enforced server-side for all business APIs before cache population.
- [x] Tests cover owner-scope resolution and the existing authenticated route/role-policy contracts; full suite passes after the account-scope implementation.

## Implementation notes

- Added `owner_app_user_id` propagation and filtering across Rooms, Tenants, Tenant CCCD images, Contracts, Utility Metrics, Utility Pricing, Invoices, Dashboard, Foundation smoke data reads, and Staff management.
- Added shared server-only owner scope resolution: landlord uses its own `app_users.id`; staff uses its assigned `owner_app_user_id`.
- Added `npm run data:migrate-account-scope` for non-destructive schema/backfill migration. It preflights that `IMPORT_OWNER_APP_USER_ID` exists and is an active landlord before applying DB changes.
- Added and ran `npm run data:migrate-account-scope-schema` against InsForge to create the `owner_app_user_id` schema columns first without choosing/backfilling an owner for existing business rows.
- Ran account-scope data migration/backfill against InsForge for owner `c4a200d3-9311-411b-a1a5-635aa42b0b2a`.
- Verified owner coverage after backfill:
  - `rooms`: total 4, owner 4, null 0
  - `tenants`: total 9, owner 9, null 0
  - `tenant_cccd_images`: total 0, owner 0, null 0
  - `contracts`: total 9, owner 9, null 0
  - `utility_metrics`: total 89, owner 89, null 0
  - `utility_pricing`: total 2, owner 2, null 0
  - `invoices`: total 89, owner 89, null 0
- Updated rental billing import so historical Rooms include `floor`, and all imported business rows receive the configured owner.
- Verification:
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm test` — 95 passing
