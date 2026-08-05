# 09 — Auth and Staff Management Client Data Slice

**What to build:** Align authentication-facing account and Staff management flows with the new API architecture while preserving secure Landlord and Staff access to operational pages.

**Blocked by:** 01 — Client Data Architecture Foundation; 02 — Invoices Client Data Slice; 03 — Room Detail Client Data Slice; 04 — Utility Metrics Client Data Slice; 05 — Utility Pricing Client Data Slice; 06 — Tenants Client Data Slice; 07 — Contracts Client Data Slice; 08 — Dashboard and Reminders Client Data Slice; MVP 02 — Set Up InsForge DB, Authentication, and API Foundation.

**Status:** ready-for-agent

## TanStack Query requirement

- [ ] Auth-facing reads use TanStack Query `useQuery` where applicable.
- [ ] Auth-facing and Staff-management writes use TanStack Query `useMutation` where applicable.
- [ ] Successful Staff-management writes invalidate or update affected current-user and Staff query keys.

- [ ] Operational APIs consistently resolve the signed-in user as Landlord or Staff through the shared auth helper.
- [ ] Auth-facing UI uses the same client fetch and API error conventions where applicable.
- [ ] Staff management flows, if present, use application services and repository interfaces before reaching the InsForge adapter.
- [ ] Unauthenticated users receive the standard unauthorized API response for operational APIs.
- [ ] Authenticated users without the required role receive the standard forbidden API response.
- [ ] Existing sign-in and sign-out behavior remains intact.
- [ ] Existing Admin-controlled account creation behavior remains intact.
- [ ] API timing logs identify auth resolution duration.
- [ ] A smoke test or behavior test verifies operational API access for signed-in Landlord or Staff users and rejection for unauthenticated users.
