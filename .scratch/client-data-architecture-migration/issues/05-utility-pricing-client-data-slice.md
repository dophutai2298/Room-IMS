# 05 — Utility Pricing Client Data Slice

**What to build:** Move Utility Pricing management into the new client data architecture so Landlords can manage global pricing through the same API/service/repository pattern used by billing.

**Blocked by:** 01 — Client Data Architecture Foundation; MVP 08 — Manage Utility Pricing and Other Fee Notes.

**Status:** ready-for-agent

## TanStack Query requirement

- [ ] Utility Pricing reads use TanStack Query `useQuery` with stable pricing query keys.
- [ ] Utility Pricing writes use TanStack Query `useMutation`.
- [ ] Successful writes invalidate or update Utility Pricing and dependent Invoice-generation query keys.

- [ ] A Landlord can load active and historical Utility Pricing rows through an authenticated app API.
- [ ] Creating or superseding Utility Pricing uses an application service and repository interface before reaching the InsForge adapter.
- [ ] The UI supports loading, empty, validation, saving, success, error, and retry states.
- [ ] Utility Pricing validation still requires an effective date and non-negative electricity and water prices.
- [ ] Historical pricing is preserved when a new active pricing row is created.
- [ ] Invoice generation can continue to resolve applicable Utility Pricing after the migration.
- [ ] API timing logs identify pricing read and write duration.
- [ ] A smoke test or behavior test verifies Utility Pricing read and create behavior for an authenticated Landlord.
