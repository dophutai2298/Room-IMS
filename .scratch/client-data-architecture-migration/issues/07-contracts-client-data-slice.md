# 07 — Contracts Client Data Slice

**What to build:** Move Contract read and mutation flows into the new client data architecture while preserving active Contract and Key Tenant rules.

**Blocked by:** 01 — Client Data Architecture Foundation; 06 — Tenants Client Data Slice; MVP 03 — Persist Room, Tenant, and Contract Data.

**Status:** ready-for-agent

- [ ] Contract data is loaded through authenticated app APIs rather than direct UI access to InsForge.
- [ ] Contract create and update flows use application services and repository interfaces before reaching the InsForge adapter.
- [ ] Contract UI supports loading, empty, validation, saving, success, error, and retry states.
- [ ] A Contract continues to reference a Room and a Key Tenant.
- [ ] The Key Tenant must continue to belong to the same Room as the Contract.
- [ ] Active Contract behavior continues to drive Occupied Room Status.
- [ ] Contract-level Utility Pricing overrides continue to be preserved.
- [ ] API timing logs identify Contract read and write duration.
- [ ] A smoke test or behavior test verifies Contract read and update behavior for an authenticated Landlord or Staff user.
