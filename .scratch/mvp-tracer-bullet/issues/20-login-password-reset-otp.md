# 20 — Login Password Reset OTP

**What to build:** Users can recover a forgotten password from the login page by requesting an email OTP, entering the OTP, setting a new password, and then signing in again with the new password. This works for active Admin/Landlord and Staff accounts without enabling public registration.

**Blocked by:** 11 — Auth and Staff Management Client Data; 19 — Staff Create-Only Permissions and Admin Staff CRUD.

**Status:** done

## Acceptance Criteria

- [x] The login page exposes a clear "Forgot password" entry point.
- [x] A user can enter an email address to request a password reset OTP email through InsForge.
- [x] The reset request response does not reveal whether the email is registered.
- [x] The reset request uses shared app API response/error/timing conventions.
- [x] A user can enter the 6-digit OTP from email.
- [x] A valid OTP can be exchanged for a reset token through the app API boundary.
- [x] A user can enter a new password and confirm password after OTP verification.
- [x] Confirm password is checked on the UI before submit.
- [x] Server-side validation rejects missing email, invalid OTP, missing token, weak password, and mismatched/invalid reset state.
- [x] Successful password reset returns the user to the login form with a success message.
- [x] Successful password reset does not auto-login the user.
- [x] Active Admin/Landlord accounts can complete password reset.
- [x] Active Staff accounts can complete password reset.
- [x] Disabled Staff/app users cannot complete password reset.
- [x] Expired or invalid OTP/token states show actionable messages and a resend path.
- [x] Resend OTP has a UI cooldown and backend guardrails to reduce email spam.
- [x] Password reset flow uses TanStack Query `useMutation` for writes.
- [x] Behavior tests cover neutral reset-request response, OTP exchange, reset success, reset failure, disabled Staff blocking, and confirm-password local validation.

## Implementation Notes

- Preferred provider flow: InsForge `sendResetPasswordEmail`, `exchangeResetPasswordToken`, and `resetPassword`.
- Keep public registration disabled.
- Preserve current sign-in behavior and safe `next` redirect behavior.
- See `.scratch/mvp-tracer-bullet/auth-password-reset-and-session-expiry-spec.md`.

## Agent Notes

- Added `/api/auth/password-reset/request`, `/api/auth/password-reset/exchange`, and `/api/auth/password-reset/complete`.
- Added InsForge password reset adapter using `sendResetPasswordEmail`, `exchangeResetPasswordToken`, and `resetPassword`.
- Reset request remains neutral for missing accounts and adds a 60-second backend resend guardrail.
- OTP exchange/reset checks `app_users.status` so disabled Staff/app users cannot reset passwords.
- `/sign-in` now uses a three-step flow: request OTP, verify OTP, then enter the new password after OTP verification.
- Password reset completion enforces app-level reset token state: token must match the verified email and expires after the earlier of InsForge `expiresAt` or 10 minutes.
- Expired/invalid OTP or reset token errors are mapped to actionable app errors with a resend path.
- Verification: focused password-reset behavior tests, `npx tsc --noEmit`, `npm run lint`, `npm test` (53/53), and `npm run build` passed.
