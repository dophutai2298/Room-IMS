# 03 — Persist Room, Tenant, and Contract Data

**What to build:** Replace mock/demo Room and Tenant data with InsForge-backed Rooms, Tenants, and active Contracts. A Landlord can list Rooms, open a Room detail view, see persisted Tenants, and represent one active Contract with one Key Tenant for the Room.

**Blocked by:** 02 — Set Up InsForge DB, Authentication, and API Foundation.

**Status:** human-review

**Implementation notes:**

- Replaced `/rooms` and `/rooms/[id]` mock reads with authenticated InsForge adapter calls.
- Added a Room presenter so status and Key Tenant rendering are derived consistently from persisted Rooms, Tenants, and active Contracts.
- Added a server action and shadcn/Tailwind form state for changing the active Contract's Key Tenant.
- Added app-level validation and a versioned SQL trigger migration to prevent Contract/Key Tenant room mismatches. The migration file is present, but applying it to InsForge via CLI failed in this environment because `npx @insforge/cli` could not fetch the package.

- [x] Rooms can be listed from persisted InsForge data.
- [x] A Room detail view shows persisted Tenants for that Room.
- [x] Room and Tenant screens use the redesigned Tailwind/shadcn foundation from ticket 01.
- [x] Loading, empty, error, and save states are represented with shadcn-based UI.
- [x] A Tenant can be marked as the Key Tenant through the active Contract relationship.
- [x] The app prevents an active Contract from using a Key Tenant that does not belong to the same Room.
- [x] Room Status is derived from active Contract state unless Maintenance is set.
- [x] Data remains present after page refresh.
