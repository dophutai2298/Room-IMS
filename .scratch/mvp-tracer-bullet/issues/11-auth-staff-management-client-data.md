# 11 — Auth and Staff Management Client Data

**What to build:** Align authentication-facing account and Staff management flows with the unified MVP API architecture while preserving secure Landlord and Staff access to operational pages.

**Blocked by:** 02 — Set Up InsForge DB, Authentication, and API Foundation; 09 — Tenants Client Data Management; 10 — Contracts Client Data Management.

**Status:** Done

## TanStack Query Requirements

- [x] Auth-facing reads use TanStack Query `useQuery` where applicable.
- [x] Auth-facing and Staff-management writes use TanStack Query `useMutation` where applicable.
- [x] Successful Staff-management writes invalidate or update affected current-user and Staff query keys.
- [x] Add sign out in when hover aria-label="Tài khoản chủ nhà" in Menu
- [x] Redirect to login if cookie/token is expire

## Acceptance Criteria

- [x] Operational APIs consistently resolve the signed-in user as Landlord or Staff through the shared auth helper.
- [x] Auth-facing UI uses TanStack Query plus the shared client API error conventions where applicable.
- [x] Staff management flows, if present, use application services and repository interfaces before reaching the InsForge adapter.
- [x] Unauthenticated users receive the standard unauthorized API response for operational APIs.
- [x] Authenticated users without the required role receive the standard forbidden API response.
- [x] Existing sign-in and sign-out behavior remains intact.
- [x] Existing Admin-controlled account creation behavior remains intact.
- [x] API timing logs identify auth resolution duration.
- [x] A smoke test or behavior test verifies operational API access for signed-in Landlord or Staff users and rejection for unauthenticated users.

## Implementation Summary

- Added `/staff` with current-user and Staff `useQuery` reads, Landlord-only Staff provisioning through `useMutation`, cache updates/invalidation, and loading/empty/error/retry/saving/success states.
- Added app-owned `/api/auth/sign-in`, `/api/auth/sign-out`, and `/api/staff` endpoints using the shared API response/error/timing conventions.
- Added the Auth and Staff service/repository boundaries plus InsForge adapters. Routine Staff reads use the signed-in session; only Landlord-authorized account provisioning uses the server-only InsForge admin key.
- Added the hover/focus account menu with identity, role-aware Staff navigation, and sign out. Expired API sessions redirect safely to `/sign-in?next=...`.
- Normalized operational routes to resolve auth before request validation, producing standard `401 AUTH_REQUIRED` and `403 FORBIDDEN` responses consistently.
- Applied InsForge migration `20260812000000_landlord-read-staff-app-users.sql` on 2026-08-12 for Landlord-scoped Staff profile reads under RLS.
- Added executable behavior coverage for auth redirects, Landlord/Staff resolution, Staff provisioning validation, and Staff HTTP 200/401/403 responses.
