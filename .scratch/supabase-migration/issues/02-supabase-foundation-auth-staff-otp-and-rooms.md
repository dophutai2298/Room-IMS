# 02 — Supabase Foundation, Auth, Staff, OTP, and Rooms

**What to build:** A Landlord can sign in to an isolated Supabase-backed deployment, manage Rooms, and manage Staff; Staff can use their existing permissions; either role can recover a password by email OTP. Existing application identities and ownership remain stable. This establishes the first complete UI → internal API → Supabase path that later tickets extend.

**Blocked by:** 01 — Rescue InsForge Data and Inventory.

**Status:** ready-for-agent

- [ ] Prepare an isolated hosted Supabase target with versioned application schema, reviewed functions/grants/RLS for application users and Rooms, and distinct browser, server and administrative credentials. Do not overwrite Supabase-managed Auth or Storage internals; document target region/plan and approved credential handling.
- [ ] Preserve `app_users.id`, Room IDs, `owner_app_user_id`, floors, rent and maintenance state. Import existing Landlord/Staff identities using an audited one-to-one Auth mapping; change only `app_users.auth_user_id` if provider Auth IDs differ. A new Landlord starts with no inherited data.
- [ ] Decide the password path using ticket 01 evidence. If compatible exported hashes are supported, verify controlled-account login after import; otherwise establish passwords through verified recovery. Do not use shared default passwords, plaintext existing passwords, blanket email auto-confirmation or public signup.
- [ ] Migrate sign-in, sign-out, refresh, protected routing and centralized operational Auth. Validate trusted Supabase identity, then resolve active status, role and owner from `app_users`. Disabled users are rejected; old InsForge cookies are not accepted, and account-specific client cache is cleared on sign-out/account change.
- [ ] Existing Room list/detail/create/update flows use Supabase through the internal `/api` contract and TanStack Query. Preserve owner scoping, validation, loading/error/retry/saving states, Room Status behavior, Dashboard room availability data contract, and Staff read/create versus Landlord update/delete rules.
- [ ] Existing Staff list/detail/create/update/delete flows work with Landlord-only administration. Staff creation uses an isolated administrative Auth operation so the Landlord session survives; partial Auth/application-user failures are reconciled and retries do not adopt an unrelated email or create duplicates.
- [ ] Configure production-capable email delivery and recovery OTP templates. Landlord and Staff can request, verify and complete password reset within ten minutes; wrong/expired/replayed codes fail, requests are neutral and throttled, and recovery state works across server instances. Incomplete recovery cannot grant operational access.
- [ ] Prove two unrelated Landlords, owned Staff, a disabled account and a new empty Landlord through browser and internal API tests. Test direct backend access using user credentials: anonymous and cross-owner requests are denied, Staff cannot update/delete, and ordinary operational requests do not bypass RLS with an admin key.
- [ ] Preserve API response/error/timing contracts and source behavior tests. Demonstrate a real isolated Supabase login, Room create/read, Staff create/read, OTP receipt/reset and logout; no production traffic is switched by this ticket.
