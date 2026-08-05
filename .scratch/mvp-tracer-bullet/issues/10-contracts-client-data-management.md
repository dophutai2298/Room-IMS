# 10 — Contracts Client Data Management

**What to build:** Move Contract read, create, and update flows into the unified MVP client-data architecture while preserving active Contract and Key Tenant rules.

**Blocked by:** 09 — Tenants Client Data Management; 03 — Persist Room, Tenant, and Contract Data.

**Status:** ready-for-agent

Folded in from `client-data-architecture-migration/issues/07-contracts-client-data-slice.md`.

## TanStack Query Requirements

- [ ] Contract reads use TanStack Query `useQuery` with stable Contract and Room query keys.
- [ ] Contract writes use TanStack Query `useMutation`.
- [ ] Successful writes invalidate or update affected Contract, Room detail, Tenant, and Invoice-related query keys.

## Acceptance Criteria

- [ ] Contract data is loaded through authenticated app APIs rather than direct UI access to InsForge.
- [ ] Contract create and update flows use application services and repository interfaces before reaching the InsForge adapter.
- [ ] Contract UI supports loading, empty, validation, saving, success, error, and retry states.
- [ ] A Contract continues to reference a Room and a Key Tenant.
- [ ] The Key Tenant must continue to belong to the same Room as the Contract.
- [ ] Active Contract behavior continues to drive Occupied Room Status.
- [ ] Contract-level Utility Pricing overrides continue to be preserved.
- [ ] API timing logs identify Contract read and write duration.
- [ ] A smoke test or behavior test verifies Contract read and update behavior for an authenticated Landlord or Staff user.
