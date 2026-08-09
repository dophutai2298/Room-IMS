# 09 — Tenants Client Data Management

**What to build:** Move Tenant list, detail, create, and update flows into the unified MVP client-data architecture while preserving existing Tenant and Key Tenant behavior.

**Blocked by:** 03 — Persist Room, Tenant, and Contract Data; Room Detail client-data migration already completed in the former client-data tracker.

**Status:** Done

Folded in from `client-data-architecture-migration/issues/06-tenants-client-data-slice.md`.

## TanStack Query Requirements

- [x] Tenant reads use TanStack Query `useQuery` with stable Tenant and Room query keys.
- [x] Tenant writes use TanStack Query `useMutation`.
- [x] Successful writes invalidate or update affected Tenant, Room detail, and Contract query keys.

## Acceptance Criteria

- [x] Tenant data is loaded through authenticated app APIs rather than direct UI access to InsForge.
- [x] Tenant create and update flows use application services and repository interfaces before reaching the InsForge adapter.
- [x] Tenant UI supports loading, empty, validation, saving, success, error, and retry states.
- [x] Tenant identity and contact fields continue to persist and render after refresh.
- [x] Key Tenant behavior remains consistent with the active Contract rules.
- [x] Existing Tenant records continue to render safely during and after migration.
- [x] API timing logs identify Tenant read and write duration.
- [x] A smoke test or behavior test verifies Tenant read and update behavior for an authenticated Landlord or Staff user.

## Implementation summary

- Added Tenant client-data slice with `tenantQueryKeys` and room-scoped tenant reads.
- Added authenticated APIs:
  - `GET/POST /api/rooms/[id]/tenants`
  - `GET/PATCH /api/tenants/[id]`
- Added Tenant service/repository contracts and InsForge adapter for list/detail/create/update.
- Replaced the static Tenant card in room detail with `TenantManagementCard` using `useQuery`/`useMutation`.
- Added create/update dialog with loading, validation, saving, success, error, empty, and retry states.
- Key Tenant updates now invalidate Tenant, Room, Contract, and Dashboard query keys so badges refresh consistently.
- Added Tenant API contract smoke and service behavior smoke coverage.
