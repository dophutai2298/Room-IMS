# 22 — Staff Email Activation OTP

**What to build:** Admin/Landlord can create a Staff account that starts as pending activation, send an email verification OTP to that Staff email, enter the OTP in Staff Management, and activate the Staff account only after the OTP is verified. Pending or disabled Staff cannot use operational APIs.

**Blocked by:** 11 — Auth and Staff Management Client Data; 19 — Staff Create-Only Permissions and Admin Staff CRUD; 20 — Login Password Reset OTP.

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] New Staff accounts are created with a pending activation state rather than immediately active.
- [ ] Existing active Staff accounts remain active after the migration.
- [ ] The app-user schema supports `pending_activation`, `active`, and `disabled` account states.
- [ ] The schema records when an activation OTP was sent and when Staff activation succeeded.
- [ ] Pending Staff accounts cannot pass operational auth or call protected operational APIs as active users.
- [ ] Disabled Staff accounts remain blocked and cannot be activated through this flow.
- [ ] Staff Management shows a clear "Chờ kích hoạt" status badge for pending Staff.
- [ ] Staff Management status filters include pending, active, and disabled states.
- [ ] Admin/Landlord can send or resend an activation OTP for a pending Staff account.
- [ ] Sending activation OTP calls InsForge email verification delivery, not password reset delivery.
- [ ] Sending activation OTP returns standard app API success/error/timing metadata and a resend cooldown.
- [ ] Admin/Landlord can enter a 6-digit OTP for the target Staff account.
- [ ] OTP verification uses the Staff row email from the server, not an email supplied by the client payload.
- [ ] Valid OTP verification marks the Staff app user active and records the activation timestamp.
- [ ] Invalid or expired OTP returns an actionable error and keeps the Staff account pending.
- [ ] Any InsForge access token/session returned by email verification is discarded and does not replace the signed-in Admin/Landlord session.
- [ ] Staff users receive standard forbidden responses when attempting to request or verify Staff activation.
- [ ] The Staff Management UI uses TanStack Query `useMutation` for send OTP and verify OTP actions.
- [ ] Successful send/verify mutations update or invalidate Staff query keys so the table refreshes without a full page reload.
- [ ] The UI shows loading, cooldown, saving, success, error, retry, and already-active states.
- [ ] Staff create success copy explains that the account is pending activation.
- [ ] The existing forgot-password flow from ticket 20 keeps working and remains separate from Staff activation.
- [ ] Behavior tests cover Staff creation pending state, pending-auth blocking, OTP request, OTP verification success, invalid/expired OTP, disabled Staff blocking, and Landlord-only authorization.
- [ ] Typecheck, lint, and the existing test suite pass.

## Implementation Notes

- Use InsForge email verification APIs for activation: `resendVerificationEmail({ email, redirectTo })` and `verifyEmail({ email, otp })`.
- The InsForge project must use code-based email verification for the Admin-entered OTP UX. If project settings use link-based verification, update the project auth setting or document the mismatch before implementation.
- Prefer adding Staff activation operations to the existing Staff service/repository/HTTP boundary instead of creating a UI-to-InsForge shortcut.
- See `.scratch/mvp-tracer-bullet/staff-email-activation-otp-spec.md`.
