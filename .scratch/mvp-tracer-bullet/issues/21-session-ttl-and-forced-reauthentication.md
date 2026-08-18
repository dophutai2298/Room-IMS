# 21 — Session TTL and Forced Reauthentication

**What to build:** Signed-in Admin/Landlord and Staff users are forced back to the login page when the product session expires around 10 minutes, and API calls consistently return/handle unauthorized responses without silently extending an expired session.

**Blocked by:** 11 — Auth and Staff Management Client Data.

**Status:** ready-for-agent

## Acceptance Criteria

- [ ] The implementation verifies the actual InsForge access-token and refresh-token expiry behavior used by the current SDK/project.
- [ ] If InsForge can enforce a 10-minute access/session TTL directly, the app uses that supported configuration.
- [ ] If InsForge cannot enforce the desired 10-minute product TTL directly, the app adds an app-level session timestamp or equivalent policy to enforce it.
- [ ] Expired sessions receive the standard unauthorized API response.
- [ ] Browser users with expired sessions are redirected to `/sign-in?next=<current-path>`.
- [ ] The redirect preserves the intended destination and rejects unsafe external redirect values.
- [ ] Refresh behavior does not silently extend a product-expired session beyond the 10-minute TTL.
- [ ] The login page can show a clear "session expired, please sign in again" message when redirected due to expiry.
- [ ] Current valid sessions continue to work before TTL expiry.
- [ ] Sign-out continues to clear the session state fully.
- [ ] Landlord/Admin and Staff sessions follow the same TTL behavior.
- [ ] Behavior tests cover valid session access, expired session 401, redirect path preservation, unsafe redirect rejection, and no silent refresh beyond product TTL.
- [ ] API timing/logging continues to identify auth-resolution duration without leaking tokens.

## Implementation Notes

- Context7 InsForge docs indicate provider token expiry may be hardcoded by InsForge defaults, so verify before changing architecture.
- Prefer enforcing the product TTL at the shared auth boundary rather than per-page checks.
- Keep existing `fetchAppApi` unauthorized redirect semantics, but extend them if needed to distinguish an expired-session message.
- See `.scratch/mvp-tracer-bullet/auth-password-reset-and-session-expiry-spec.md`.
