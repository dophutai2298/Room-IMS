# 11 — Auth and Staff Management Client Data

**What to build:** Align authentication-facing account and Staff management flows with the unified MVP API architecture while preserving secure Landlord and Staff access to operational pages.

**Blocked by:** 02 — Set Up InsForge DB, Authentication, and API Foundation; 09 — Tenants Client Data Management; 10 — Contracts Client Data Management.

**Status:** ready-for-agent

Folded in from `client-data-architecture-migration/issues/09-auth-staff-management-client-data-slice.md`.

## TanStack Query Requirements

- [ ] Auth-facing reads use TanStack Query `useQuery` where applicable.
- [ ] Auth-facing and Staff-management writes use TanStack Query `useMutation` where applicable.
- [ ] Successful Staff-management writes invalidate or update affected current-user and Staff query keys.

## Acceptance Criteria

- [ ] Operational APIs consistently resolve the signed-in user as Landlord or Staff through the shared auth helper.
- [ ] Auth-facing UI uses TanStack Query plus the shared client API error conventions where applicable.
- [ ] Staff management flows, if present, use application services and repository interfaces before reaching the InsForge adapter.
- [ ] Unauthenticated users receive the standard unauthorized API response for operational APIs.
- [ ] Authenticated users without the required role receive the standard forbidden API response.
- [ ] Existing sign-in and sign-out behavior remains intact.
- [ ] Existing Admin-controlled account creation behavior remains intact.
- [ ] API timing logs identify auth resolution duration.
- [ ] A smoke test or behavior test verifies operational API access for signed-in Landlord or Staff users and rejection for unauthenticated users.
