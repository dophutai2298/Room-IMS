# 12 — Rooms Client Data and Room Management

**What to build:** Complete the Room management surface so a Landlord or Staff member can load Rooms through the unified client-data architecture, create a Room, update Room information, and have Dashboard room availability reuse the same Room domain read path instead of maintaining a separate dashboard-only Room query path.

**Blocked by:** 03 — Persist Room, Tenant, and Contract Data; 07 — Add Dashboard Reminders for Monthly Operations.

**Status:** Done

- [x] `/rooms` renders as a fast shell with a Client Component that loads Room data through TanStack Query `useQuery`.
- [x] `/api/rooms` returns the authenticated Room list used by the Room management screen.
- [x] Room list reads use stable Room query keys and the shared `fetchAppApi` client convention.
- [x] A Landlord or Staff member can create a Room from the Rooms screen with name, base rent, and initial maintenance/status intent where appropriate.
- [x] A Landlord or Staff member can update a Room's name, base rent, and maintenance status.
- [x] Room create and update flows use TanStack Query `useMutation`.
- [x] Room writes validate required fields, non-negative base rent, and valid maintenance/status values before writing.
- [x] Room writes use application services and repository interfaces before reaching the InsForge adapter.
- [x] Room create/update success updates or invalidates Room list, Room detail, Dashboard room availability, Dashboard missing Utility Metrics, and any affected operations-summary query keys.
- [x] Dashboard room availability no longer owns a separate duplicated Room aggregation path when the Room domain service can provide the same computed Room Status data.
- [x] The existing dashboard room-availability API contract can remain as a dashboard facade, but its implementation should reuse Room service/repository logic where practical.
- [x] The Dashboard missing Utility Metrics flow can reuse the Room list/status computation when identifying occupied Rooms missing metrics for the billing period.
- [x] `/rooms` supports loading, empty, error, retry, saving, validation, and success states using the existing Tailwind/shadcn and Sonner patterns.
- [x] Room Status remains derived from active Contract state unless the Room is marked Maintenance.
- [x] Existing seeded Rooms continue to render safely during and after migration.
- [x] API timing logs identify Room list, Room create, and Room update durations.
- [x] A smoke test or behavior test verifies Room list, create, and update behavior for an authenticated Landlord or Staff user.

## Implementation Notes

- This ticket intentionally does not renumber existing tickets 09-11. It fills the missing Room management slice discovered after issue 07.
- Prefer a list-level Room API over calling per-Room detail or operations-summary APIs from the Room list or Dashboard.
- The dashboard-specific API may stay as the UI contract, but it should behave as a facade over shared Room domain logic instead of duplicating lower-level InsForge queries for Room availability.
- Tenant and Contract create/update flows remain in tickets 09 and 10. This ticket should only touch them where needed to preserve Room Status derivation and query invalidation.
- `/rooms` now uses a client Room management component with TanStack Query read/write behavior.
- Added authenticated Room list/create/update APIs with API timing.
- Extended the Room repository/service boundary for list, create, and update behavior.
- Dashboard room availability and missing Utility Metrics now reuse Room domain list/status computation through the Room repository.
- Added Room management API contract smoke data and service behavior smoke coverage.
