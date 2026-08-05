# 09 — Tenants Client Data Management

**What to build:** Move Tenant list, detail, create, and update flows into the unified MVP client-data architecture while preserving existing Tenant and Key Tenant behavior.

**Blocked by:** 03 — Persist Room, Tenant, and Contract Data; Room Detail client-data migration already completed in the former client-data tracker.

**Status:** ready-for-agent

Folded in from `client-data-architecture-migration/issues/06-tenants-client-data-slice.md`.

## TanStack Query Requirements

- [ ] Tenant reads use TanStack Query `useQuery` with stable Tenant and Room query keys.
- [ ] Tenant writes use TanStack Query `useMutation`.
- [ ] Successful writes invalidate or update affected Tenant, Room detail, and Contract query keys.

## Acceptance Criteria

- [ ] Tenant data is loaded through authenticated app APIs rather than direct UI access to InsForge.
- [ ] Tenant create and update flows use application services and repository interfaces before reaching the InsForge adapter.
- [ ] Tenant UI supports loading, empty, validation, saving, success, error, and retry states.
- [ ] Tenant identity and contact fields continue to persist and render after refresh.
- [ ] Key Tenant behavior remains consistent with the active Contract rules.
- [ ] Existing Tenant records continue to render safely during and after migration.
- [ ] API timing logs identify Tenant read and write duration.
- [ ] A smoke test or behavior test verifies Tenant read and update behavior for an authenticated Landlord or Staff user.
