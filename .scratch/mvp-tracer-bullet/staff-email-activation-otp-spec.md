Status: ready-for-agent

# Staff Email Activation OTP

## Problem Statement

Admin/Landlord can currently create Staff accounts from Staff Management, but a newly created Staff account is treated as operationally active immediately. That means the system trusts the Staff email before it has been verified by an OTP sent to that email address.

The desired behavior is: after Admin creates a Staff account, the Staff account must remain in a pending activation state. Admin then explicitly sends an OTP to the Staff email, enters the OTP in the Staff Management UI, and only after the OTP is verified does the Staff account become active and able to use the rental management system.

This keeps public registration disabled, preserves Admin-controlled Staff provisioning, and adds an email ownership check before Staff can operate on rental data.

## Solution

Add an Admin-driven Staff email activation flow on top of the existing Staff Management feature:

- New Staff accounts are created as pending activation, not active.
- Admin/Landlord can send or resend an email verification OTP to a pending Staff account.
- Admin/Landlord can enter the 6-digit OTP in the Staff Management UI.
- The app verifies the OTP against the Staff email through InsForge email verification APIs.
- After successful verification, the app marks the Staff app user as active.
- Pending or disabled Staff accounts cannot pass operational auth.

Context7 InsForge docs confirm the relevant SDK methods:

- `resendVerificationEmail({ email, redirectTo })` sends or resends an email verification code or link depending on project auth settings.
- `verifyEmail({ email, otp })` verifies a 6-digit email OTP and returns auth data.

The implementation should use the code-based verification flow when the InsForge project is configured with `verifyEmailMethod=code`.

## User Stories

1. As an Admin/Landlord, I want newly created Staff accounts to start in a pending activation state, so that Staff cannot operate before their email is verified.
2. As an Admin/Landlord, I want to see which Staff accounts are pending activation, so that I know who still needs verification.
3. As an Admin/Landlord, I want to click "Send OTP" for a pending Staff account, so that the verification code is sent to the Staff email.
4. As an Admin/Landlord, I want to resend the OTP after a cooldown, so that I can recover if the Staff did not receive the first email.
5. As an Admin/Landlord, I want to enter the OTP for the target Staff account, so that the app can verify that email address.
6. As an Admin/Landlord, I want a clear success message after OTP verification, so that I know the Staff account is now active.
7. As an Admin/Landlord, I want invalid or expired OTP errors to explain what to do next, so that I can resend and retry without guessing.
8. As an Admin/Landlord, I want active Staff accounts to remain active after this feature ships, so that existing production data is not accidentally locked out.
9. As an Admin/Landlord, I want disabled Staff accounts to stay disabled and not receive activation, so that deleted/deactivated users cannot return by OTP.
10. As a Staff member whose account is pending activation, I want login/operational access to be blocked until activation, so that account setup follows the Admin process.
11. As a Staff member, I want the OTP email to arrive at my registered email address, so that I can prove the account email is correct.
12. As a developer, I want activation APIs to use the existing app API response/error/timing conventions, so that auth behavior stays observable.
13. As a developer, I want the activation flow to reuse the Staff service/repository and InsForge adapter seams, so that UI does not call InsForge directly.
14. As a developer, I want behavior tests around pending activation, OTP request, OTP verification, and auth blocking, so that future Staff/auth changes do not regress activation.

## Implementation Decisions

- Treat "Admin" in UI copy as the existing Landlord role unless a separate Admin role is introduced later.
- Extend the app-user account lifecycle with a `pending_activation` state. Existing meanings remain:
  - `pending_activation`: Staff was provisioned but email OTP has not been verified.
  - `active`: Staff can pass operational auth and use allowed Staff operations.
  - `disabled`: Staff has been deactivated and cannot be activated through this flow.
- Update the app-user database schema and local schema file so `app_users.status` accepts `pending_activation`.
- Add activation audit fields for Staff accounts:
  - `activated_at` when OTP verification succeeds.
  - `activation_email_sent_at` when Admin sends or resends the activation OTP.
- Keep existing active Staff rows as `active` during migration. Do not force existing Staff through activation retroactively.
- Change Staff creation so new Staff app-user rows are saved as `pending_activation`. The auth user should not be auto-confirmed for this flow.
- Verify the current InsForge SDK/project behavior around Staff creation:
  - If sign-up automatically sends the first verification email when email verification is enabled, the Staff Management "Send OTP" action should still exist and function as an explicit resend/actionable step.
  - If sign-up can create the user without automatically emailing, the Staff Management "Send OTP" action should be the first email trigger.
- Add Landlord/Admin-only activation API endpoints under the Staff API boundary:
  - request activation OTP for a Staff account,
  - verify activation OTP for a Staff account.
- The activation request endpoint should look up the Staff row by ID, use the Staff row email as the target email, call InsForge `resendVerificationEmail`, update `activation_email_sent_at`, and return the updated Staff item plus resend cooldown metadata.
- The activation verify endpoint should look up the Staff row by ID, use the Staff row email as the verified email, call InsForge `verifyEmail({ email, otp })`, discard any returned Staff access token/session, and then mark the app-user row active with `activated_at`.
- Do not let activation verification replace the signed-in Admin/Landlord session. Any access token returned by InsForge verification belongs to the Staff user and must not be written to the Admin browser session.
- Only pending Staff can receive activation OTP. Active Staff should return an already-active/no-op response or a clear conflict; disabled Staff should be rejected.
- Operational auth should reject any signed-in app user whose status is not `active`. This means `pending_activation` must not be treated as active by default fallback logic.
- Staff Management UI should:
  - show a "Chờ kích hoạt" status badge,
  - include pending activation in status filter options,
  - show activation actions for pending Staff,
  - use TanStack Query `useMutation` for send OTP and verify OTP,
  - invalidate/update Staff list query keys after send and verify,
  - show loading, cooldown, saving, success, invalid OTP, expired OTP, and retry states.
- Preserve the existing Staff create/update/delete permissions from ticket 19. Staff users cannot activate themselves through protected Admin APIs.
- Preserve the password reset OTP flow from ticket 20. Activation OTP is a separate email verification flow and should not reset passwords.

## Testing Decisions

- Test behavior through high-level seams: Staff service/use-case functions, Staff HTTP handlers, operational auth resolution, and form helpers where UI-local validation exists.
- Add behavior tests for Staff creation returning `pending_activation`.
- Add behavior tests that pending Staff cannot pass operational auth.
- Add behavior tests that active Staff can still pass operational auth and disabled Staff stays blocked.
- Add behavior tests for activation OTP request:
  - Landlord/Admin can request OTP for pending Staff.
  - Staff users receive a standard forbidden API response.
  - disabled Staff cannot receive activation OTP.
  - resend cooldown is applied.
- Add behavior tests for activation OTP verification:
  - valid OTP marks Staff active.
  - invalid/expired OTP returns actionable app errors.
  - verification uses the Staff row email, not an arbitrary email from payload.
  - returned InsForge auth/session data is not used to replace the Admin session.
- Add UI/form-level coverage for:
  - "Send OTP" and verify dialog states,
  - OTP must be 6 digits,
  - mutations invalidate/update the Staff list.
- Avoid tests that assert InsForge internals. Mock the Staff activation repository seam around `resendVerificationEmail` and `verifyEmail`.

## Out of Scope

- Public Staff self-registration.
- Staff self-activation from a public page.
- SMS OTP, authenticator apps, MFA, passkeys, or social login.
- Changing Staff email during activation.
- Admin-forced password reset.
- Hard-deleting InsForge auth users.
- Requiring existing active Staff accounts to re-verify their email.
- Implementing session TTL; that remains in the separate session-expiry ticket.

## Further Notes

- This spec intentionally separates activation OTP from password reset OTP. Password reset proves a user can recover an existing account password; activation proves the Staff email is reachable before the account becomes operational.
- The safest UX is a single "Kích hoạt Staff" dialog containing both "Gửi OTP" and "Xác minh OTP" so Admin does not need to jump between screens.
- If later we want Staff to self-activate, this spec can be extended with a public activation route. For now, the user explicitly requested Admin-triggered send and Admin-entered OTP.
