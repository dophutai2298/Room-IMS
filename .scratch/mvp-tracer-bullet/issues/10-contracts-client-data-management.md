# 10 — Contracts Client Data Management

**What to build:** Move Contract read, create, and update flows into the unified MVP client-data architecture while preserving active Contract and Key Tenant rules.

**Blocked by:** 09 — Tenants Client Data Management; 03 — Persist Room, Tenant, and Contract Data.

**Status:** Done

Folded in from `client-data-architecture-migration/issues/07-contracts-client-data-slice.md`.

## TanStack Query Requirements

- [x] Contract reads use TanStack Query `useQuery` with stable Contract and Room query keys.
- [x] Contract writes use TanStack Query `useMutation`.
- [x] Successful writes invalidate or update affected Contract, Room detail, Tenant, and Invoice-related query keys.

## Acceptance Criteria

- [x] Contract data is loaded through authenticated app APIs rather than direct UI access to InsForge.
- [x] Contract create and update flows use application services and repository interfaces before reaching the InsForge adapter.
- [x] Contract UI supports loading, empty, validation, saving, success, error, and retry states.
- [x] A Contract continues to reference a Room and a Key Tenant.
- [x] The Key Tenant must continue to belong to the same Room as the Contract.
- [x] Active Contract behavior continues to drive Occupied Room Status.
- [x] Contract-level Utility Pricing overrides continue to be preserved.
- [x] API timing logs identify Contract read and write duration.
- [x] A smoke test or behavior test verifies Contract read and update behavior for an authenticated Landlord or Staff user.

## Implementation Summary

- Added authenticated Contract list/create/update APIs with validation, timing spans, application services, repository interfaces, and an InsForge adapter.
- Replaced the Key Tenant server action with a Contract management card powered by TanStack Query, including active and historical Contract states.
- Added create/update forms for Key Tenant, rent, deposit, dates, status, and optional electricity/water price overrides.
- Contract writes update the Contract cache and invalidate Room, Tenant, Invoice, and Dashboard dependents so Occupied status and operational data refresh together.
- Added executable `npm test` behavior coverage for Landlord/Staff authentication, Contract reads, create/update behavior, validation, and pricing override preservation; API response shapes remain compile-time checked.
