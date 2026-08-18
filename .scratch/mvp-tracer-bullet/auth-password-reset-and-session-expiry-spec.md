Status: ready-for-agent

# Auth Password Reset OTP and Session Expiry

## Clarifying Questions and Recommended Answers

1. Should password reset use an OTP code or a magic reset link?
   - Recommended answer: use InsForge's code-based reset flow: send a 6-digit code by email, exchange the code for a reset token, then submit the new password.
2. Who can use forgot password?
   - Recommended answer: any active Landlord/Admin or Staff auth user can request a reset from the login page. Public registration remains disabled.
3. Should the UI reveal whether an email exists?
   - Recommended answer: no. The request screen should always show a neutral success message when the email format is valid.
4. How strict is the 10-minute TTL requirement?
   - Recommended answer: enforce a 10-minute product TTL in the app flow. If InsForge returns a shorter `expiresAt`, use the shorter expiry. If InsForge's provider token lives longer, the app should still expire the local reset step after 10 minutes.
5. After a successful password reset, should the user be automatically signed in?
   - Recommended answer: no. Send the user back to the login form with a success message and require sign-in with the new password.
6. Should users be able to resend OTP?
   - Recommended answer: yes, but with a visible cooldown and backend rate limiting so the feature cannot be used for email spam.

## Problem Statement

Landlord/Admin and Staff users can sign in only when they remember their password. If a password is forgotten, there is no self-service recovery path from the login page, so the user must ask someone with access to InsForge or the project admin flow to intervene manually. This is painful for Staff because Staff accounts are created by Admin/Landlord and then handed off for day-to-day operations.

There is also a session-security expectation that expired auth tokens should not silently keep users in the management system. The app already redirects unauthorized API responses to login, but the desired product behavior is stricter: session validity should be checked against a short TTL around 10 minutes, and once that session expires the user should be forced back through login.

## Solution

Add a self-service "Forgot password" flow on the login page for active Landlord/Admin and Staff accounts. The user enters their email, receives a 6-digit reset code, enters that code plus a new password, and then returns to login after success. The flow should use InsForge's password-reset APIs where possible:

- send reset password email,
- exchange reset password code for a reset token,
- reset the password with the token and new password.

Add an app-level session expiry policy so expired sessions redirect to the login page and preserve the intended destination in `next`. The app should treat the product TTL as approximately 10 minutes. InsForge documentation notes that default access-token expiry may be provider-owned, so the implementation should verify whether the SDK/project configuration can enforce 10 minutes directly. If not, enforce the 10-minute rule at the app boundary with a local session timestamp or equivalent server-side check.

## User Stories

1. As a Landlord/Admin, I want to click "Forgot password" from the login page, so that I can recover access without manual backend intervention.
2. As a Staff member, I want to reset my password from the same login page, so that I do not need Admin/Landlord to create a replacement account.
3. As a user requesting a password reset, I want to enter my email address, so that the system can send a recovery code to the account email.
4. As a user requesting a password reset, I want the system to show a neutral message even if the email is not registered, so that account existence is not exposed.
5. As a user who received an OTP, I want to enter the 6-digit code, so that the system can verify the reset request.
6. As a user who entered a valid OTP, I want to enter and confirm a new password, so that I can recover account access.
7. As a user setting a new password, I want clear validation when the password is too short or confirmation does not match, so that I can fix mistakes immediately.
8. As a user whose reset code expired, I want a clear message and resend option, so that I know how to restart the reset flow.
9. As a user, I want resend to have a cooldown, so that accidental repeated clicks do not spam my inbox.
10. As a Landlord/Admin, I want disabled Staff accounts to remain unable to recover access, so that deactivated Staff cannot return through password reset.
11. As a signed-in user, I want the app to redirect me to login after my session expires, so that stale sessions cannot continue operating the management system.
12. As a signed-in user, I want the login redirect to preserve my destination, so that after signing in again I return to the page I was using.
13. As a user on the login page, I want success and error states to be understandable, so that I know whether to check email, retry, or contact Admin/Landlord.
14. As a developer, I want auth reset APIs to use the same app API response/error/timing conventions as sign-in, so that auth behavior stays observable and testable.
15. As a developer, I want reset-password and session-expiry behavior covered by behavior tests, so that future auth changes do not regress login security.

## Implementation Decisions

- Use a login-page password recovery mode or route that feels like part of the existing sign-in card rather than a separate public registration flow.
- Use app-owned API routes for password reset request, OTP exchange, and password update. The client should call these routes with TanStack Query mutations and shared API error handling.
- Use InsForge's code-based reset flow if available in the current SDK/project settings. The expected provider operations are: send reset password email, exchange reset password code, then reset password with the exchanged token.
- Do not expose whether an email exists. Reset-request success messaging should be neutral.
- Treat disabled app users as ineligible for password reset completion. If InsForge sends a code before the app can verify the app-user status, the app should block completion before resetting the password.
- New password validation should include minimum length and confirm-password matching on the UI, with server-side validation for trusted enforcement.
- Successful reset should not create an authenticated session. The user should return to login and sign in with the new password.
- Add a product session TTL around 10 minutes. If InsForge access-token TTL cannot be configured down to 10 minutes, enforce an app-level session policy at the API/auth boundary.
- Session expiry should produce the standard unauthorized response for API calls and redirect browser users to `/sign-in?next=<current-path>`.
- Any refresh behavior must not silently extend a session beyond the product TTL unless the user signs in again.
- Reuse the existing auth service/repository and InsForge adapter vocabulary where possible instead of coupling UI directly to InsForge SDK calls.

## Testing Decisions

- Test behavior through public seams: app API routes/auth services for reset and session expiry, and client form helpers for local password confirmation or step-state rules.
- Add behavior tests for: reset request neutral response, OTP exchange success/failure, password confirmation validation, expired reset token behavior, disabled Staff blocked from reset completion, and expired session redirect/401 behavior.
- Prefer the existing auth behavior tests and API response contract tests as prior art.
- Avoid tests that assert InsForge internals. Mock the repository/adapter seam around InsForge auth operations.

## Out of Scope

- Public account registration.
- Admin-forced password reset from the Staff management page.
- MFA, passkeys, social login, or SMS OTP.
- Changing user email during password recovery.
- Building a custom email delivery provider unless InsForge project email settings are insufficient.
- Long-lived "remember me" sessions.

## Further Notes

- Context7 InsForge docs show support for `sendResetPasswordEmail`, `exchangeResetPasswordToken`, and `resetPassword` for code-based reset flows.
- Context7 InsForge docs also note provider token expiry may be hardcoded by InsForge defaults. The implementation ticket should verify the actual SDK/project behavior before deciding whether TTL enforcement belongs in InsForge config or app-level session policy.
