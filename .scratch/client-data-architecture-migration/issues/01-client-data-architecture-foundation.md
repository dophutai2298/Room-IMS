# 01 — Client Data Architecture Foundation

**What to build:** Establish the shared architecture foundation for fast-loading management pages, so future slices can render UI shells quickly while loading data through a consistent authenticated API boundary.

**Blocked by:** MVP 02 — Set Up InsForge DB, Authentication, and API Foundation.

**Status:** ready-for-agent

- [x] The project has a documented convention for client-loaded operational screens.
- [x] There is a standard API response shape for successful and failed responses.
- [x] API errors use a shared vocabulary for unauthorized, forbidden, validation, not found, conflict, and internal errors.
- [x] There is a shared API auth helper that resolves the signed-in Landlord or Staff user for operational endpoints.
- [x] There is a client fetch helper or hook convention for calling app APIs from browser UI.
- [x] There is a timing helper that can measure API total duration, auth resolution, service work, and repository or adapter calls.
- [x] The foundation does not migrate the Invoice page, Room detail page, or any major business workflow yet.
- [x] The foundation preserves existing authentication and business behavior.
- [x] The architecture convention explains that UI must not call InsForge operational data adapters directly.
