# 19 — Staff Create-Only Permissions and Admin Staff CRUD

**What to build:** Staff users can safely operate the rental system in a create-only mode: they can read operational data and add new operational records, but they cannot update or delete existing data. Landlord/Admin users keep full control, including updating/deleting Staff accounts. Staff account creation also gets a UI-only password confirmation field before the request is sent.

**Blocked by:** 11 — Auth and Staff Management Client Data; 18 — Upgrade Management Data Tables.

**Status:** Done

## Role Policy Requirements

- [x] Define the product policy clearly in code/tests: Landlord/Admin can read, create, update, and delete; Staff can read and create operational records only.
- [x] Staff receives the standard forbidden API response when attempting to update existing operational records.
- [x] Staff receives the standard forbidden API response when attempting to delete operational records.
- [x] Staff can still use GET endpoints for operational screens.
- [x] Staff can still use create/add flows for operational records that are safe for Staff, such as adding tenants, contracts, utility metrics, or other non-admin operational data.
- [x] Admin-only configuration and account-management writes remain Landlord/Admin-only, including Staff management and Utility Pricing configuration.
- [x] Any endpoint that currently behaves like an upsert must distinguish create-vs-update semantics, or be adjusted so Staff cannot modify an existing record through a create-looking flow.

## Staff Account Creation Requirements

- [x] The Staff creation dialog includes a confirm password field.
- [x] Confirm password is validated on the UI only before submit.
- [x] The API payload sent to account provisioning does not include confirm password.
- [x] The submit action is blocked with a clear inline validation message when password and confirm password do not match.
- [x] Existing password validation, loading, success, error, and cache invalidation behavior remains intact.

## Admin Staff Management Requirements

- [x] Landlord/Admin can update Staff profile fields from the Staff management table or dialog.
- [x] Landlord/Admin can delete a Staff account from the Staff management table.
- [x] Staff update/delete actions are hidden or disabled for non-Landlord users.
- [x] Staff update/delete APIs are Landlord/Admin-only and return standard forbidden responses for Staff users.
- [x] Deleting Staff keeps application data consistent between the auth user and the app-user role mapping. If the auth provider cannot safely hard-delete the auth user, the implementation must use an explicit deactivation/soft-delete behavior and show that state in the UI.
- [x] Staff list/query cache is updated or invalidated after create, update, and delete.

## UX Requirements

- [x] Staff management table keeps search, sort, pagination, and column visibility behavior after adding update/delete actions.
- [x] Destructive delete action requires confirmation before executing.
- [x] Success and failure toasts/messages clearly explain what happened.
- [x] The UI copy consistently uses “Admin/Landlord” for the account that can manage Staff, and “Staff” for create-only users.

## Verification

- [x] Behavior tests cover the role policy for at least one GET, one allowed Staff create, one forbidden Staff update, and one forbidden Staff delete path.
- [x] Staff service/repository tests cover Staff update and delete behavior.
- [x] Staff HTTP boundary tests cover Landlord/Admin success and Staff forbidden responses for update/delete.
- [x] UI or presenter-level coverage verifies confirm password blocks submit locally and is not sent to the API payload.
- [x] Typecheck, lint, and the existing test suite pass.

## Implementation Notes

- Treat “Admin” in UI copy as the existing Landlord role unless a separate Admin role is introduced in a later ticket.
- Prefer a shared route-permission/policy helper or explicit route metadata so future API routes do not accidentally allow Staff update/delete operations.
- Do not change public registration behavior; Staff accounts must still be created only after a Landlord/Admin is signed in.
- Implemented a shared role policy helper in `src/lib/server/role-policy.ts`.
- Staff delete uses app-level soft-delete via `app_users.status = 'disabled'` because no safe InsForge auth hard-delete API is exposed in the current SDK surface. Disabled app users are rejected during current-user resolution.
- Utility Metrics save distinguishes create vs update: Staff may create a missing period, but cannot overwrite an existing period. Insert failures are only converted to Staff-forbidden when they indicate an existing unique period conflict.
- RLS policies now mirror the route policy: active Staff can `SELECT`/`INSERT` operational tables, while `UPDATE`/`DELETE` and Utility Pricing writes require Admin/Landlord. This prevents bypassing Next API permissions through direct InsForge DB calls.
- Added DB migration `migrations/20260815000000_staff-account-status-and-admin-crud.sql` and updated `schema.sql`.
- Verified with:
  - `node --conditions=react-server --import tsx --test src/lib/server/role-policy.behavior.test.ts src/lib/server/operational-route.behavior.test.ts src/lib/staff/create-staff-form.behavior.test.ts src/lib/staff/staff.behavior.test.ts`
  - `npx.cmd tsc --noEmit`
  - `npm.cmd test`
  - `npm.cmd run lint`
  - `npm.cmd run build`
