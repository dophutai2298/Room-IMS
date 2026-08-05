# 03 — Room Detail Client Data Slice

**What to build:** Make Room detail pages feel fast by rendering the Room shell quickly and loading Room, Tenant, Contract, Utility Metrics, and Invoice summary data through the new client data architecture.

**Blocked by:** 01 — Client Data Architecture Foundation; MVP 03 — Persist Room, Tenant, and Contract Data; MVP 04 — Record Monthly Utility Metrics; MVP 05 — Generate Invoices From Utility Metrics.

**Status:** done

## TanStack Query requirement

- [x] Room detail reads use TanStack Query `useQuery` with stable Room query keys.
- [x] Independent Room detail sections use independent queries where practical.
- [x] Retry uses TanStack Query `refetch`.

- [x] Opening a Room detail page shows the main shell and loading state quickly.
- [x] Room detail data is loaded through authenticated app APIs rather than direct UI access to InsForge.
- [x] The Room detail API uses an application service and repository interface before reaching the InsForge adapter.
- [x] The Room detail screen supports loading, empty, error, retry, and success states.
- [x] Room Status remains computed using the existing business meaning of Available, Occupied, and Maintenance.
- [x] Tenant, Key Tenant, active Contract, Utility Metrics summary, and Invoice summary information remain visible after data loads.
- [x] One slow Room detail section does not unnecessarily hide the entire page where progressive section loading is practical.
- [x] API timing logs identify the expensive parts of Room detail loading.
- [x] A smoke test or behavior test verifies the Room detail API for an authenticated Landlord or Staff user.
