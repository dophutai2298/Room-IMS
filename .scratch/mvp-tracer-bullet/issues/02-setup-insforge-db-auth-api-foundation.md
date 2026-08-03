# 02 — Set Up InsForge DB, Authentication, and API Foundation

**What to build:** Prepare the InsForge backend foundation for the MVP tracer bullet: database schema, authentication, app user roles, seed data, and a small app-facing API/data adapter for the Next.js UI. This ticket makes the real InsForge data path available; it does not need to replace every mock screen by itself.

**Blocked by:** 01 — Set Up Tailwind, shadcn/ui, Clay Dashboard, Charts, and Themes.

**Status:** human-review

**Implementation notes:**

- Applied InsForge migrations `20260802000000_insforge-db-auth-api-foundation` and `20260802010000_invoice-payment-status-constraints` on 2026-08-02.
- Added versioned migration in `migrations/` and kept `schema.sql` as the traceable source.
- Added Next.js/InsForge SSR auth foundation, protected route proxy, refresh route, sign-in page, and app-facing adapter/API boundary.
- Verified `dophutai.2298@gmail.com` through InsForge email OTP on 2026-08-02, mapped the auth user to `public.app_users.role = 'landlord'`, and confirmed sign-in + role resolution through the InsForge SDK.
- Remaining end-to-end check: verify the simple write foundation endpoint from the signed-in app session and observe it after refresh.

- [x] The live or local InsForge project has the MVP schema needed for Rooms, Tenants, Contracts, Utility Metrics, Utility Pricing, Invoices, and app user roles.
- [x] Invoices include a non-negative `amount_paid` field constrained to never exceed `total_amount`, so partial payments and collected-revenue charts can be calculated accurately.
- [x] The schema is traceable back to the existing SQL file, with documented changes for auth/profile and Utility Pricing.
- [x] InsForge auth is configured and usable from the Next.js app.
- [x] Protected operational routes redirect or block unauthenticated users.
- [x] A signed-in user can be resolved to Landlord or Staff.
- [x] The app has one reusable InsForge adapter/API boundary for auth and database operations.
- [x] InsForge project URL and public keys are kept in environment/config rather than scattered through page code.
- [x] Seed data supports the full MVP demo flow: occupied Room, available Room, Key Tenant, active Contract, prior Utility Metrics, current Utility Pricing, and one Invoice state.
- [x] Seeded Rooms, Tenants, Contracts, Utility Metrics, Utility Pricing, and Invoices can be read through the app adapter.
- [ ] A simple write can be performed through the adapter and observed after refresh.
- [x] Backend errors are surfaced through the adapter in a consistent shape.
