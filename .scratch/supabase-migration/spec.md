# Migrate Hosted InsForge to Supabase

Status: ready-for-agent
Created: 2026-11-24
Scope: Migration specification; implementation and production cutover are separate work.
Testing approach: Approved by the user — internal `/api` acceptance, browser authentication/OTP and CCCD uploads, plus migrated-data reconciliation.

## Problem Statement

The rental management application depends on hosted InsForge for PostgreSQL data, authentication, and Tenant CCCD images. The user needs to move these capabilities to hosted Supabase without losing business history, account access, ownership isolation, or existing workflows.

According to the shutdown email supplied by the user, InsForge Free projects stop on **December 7, 2026**, and paused Free projects can no longer be restored. The hosted service closes on March 31, 2027, but that later date is not a safe deadline for this Free project. Exporting recoverable data before December 7 is the first priority. InsForge site-deployment changes on December 1 are separate from the application's existing Vercel frontend deployment.

A connection-string change is insufficient: authentication identities, sessions, OTP recovery, administrative Staff provisioning, storage objects, RLS policies, and provider-specific adapters also depend on InsForge. Copying SQL or image URLs alone would leave essential functionality dependent on the retiring service.

## Solution

Perform a backup-first, rehearsed migration to Supabase while retaining the current Next.js application, TanStack Query client-data architecture, internal API contracts, and service/repository boundaries.

Preserve application UUIDs, ownership, historical billing values, and actual image bytes. Migrate authentication with an explicit identity mapping and a verified password-transfer or password-reset strategy. Rehearse in an isolated target before a controlled production write freeze, final synchronization, deployment, and reopening.

Deliver an ordered runbook with evidence and exit gates. Authoring this specification does not authorize production imports, migration emails, paid resources, or deployment. Execution requires the relevant implementation/release authorization and source/target access.

## User Stories

1. As a Landlord, I want a recoverable export before my Free project stops, so that a hosting deadline cannot erase my rental records.
2. As a Landlord, I want my existing application identity preserved, so that my owned records remain associated with me.
3. As a Landlord, I want Rooms, floors, rent, and maintenance status preserved, so that property management continues unchanged.
4. As a Landlord, I want Tenant profiles, CCCD numbers, and Room assignments preserved, so that resident information remains accurate.
5. As a Landlord, I want all Tenant CCCD images available after migration, so that existing profile evidence is not lost.
6. As a Tenant whose documents are stored, I want image access restricted to authorized operators, so that my identity documents are not publicly exposed.
7. As a Landlord, I want Contracts and Key Tenant relationships preserved, so that occupancy and billing remain consistent.
8. As a Staff member, I want historical Utility Metrics preserved, so that I can continue monthly recording without re-entering readings.
9. As a Landlord, I want effective Utility Pricing and Contract overrides preserved, so that future invoices use the correct prices.
10. As a Landlord, I want historical Invoices preserved without regeneration, so that migration cannot change previously billed amounts.
11. As a Landlord, I want payment amounts and statuses preserved, so that outstanding balances remain trustworthy.
12. As a Landlord, I want discounts, other fees, and their notes preserved, so that each Invoice retains its financial meaning.
13. As a Landlord, I want previous-balance suggestions to behave as before, so that migration does not introduce duplicate or automatic debt postings.
14. As a Landlord, I want invoice PDF and table Excel exports to work after migration, so that I can continue sending and reviewing documents.
15. As a Landlord, I want Dashboard totals, reminders, selected periods, chart ranges, and Brush behavior preserved, so that monthly operations remain familiar.
16. As an existing user, I want a documented way to sign in after migration, so that a changed authentication provider does not lock me out.
17. As an existing user, I want my password preserved only when a verified secure transfer is possible, so that migration does not rely on guessed compatibility or shared passwords.
18. As a Landlord or Staff member, I want email OTP recovery to work with real email delivery, so that I can regain access without public registration.
19. As a Landlord, I want to create Staff without replacing my own session, so that administrative work remains safe.
20. As a Staff member, I want my existing read/create permissions preserved, so that migration does not accidentally grant update/delete privileges.
21. As a disabled user, I want access to remain disabled, so that migration cannot reactivate a revoked account.
22. As a new Landlord, I want an empty workspace, so that another account's data is never assigned to me during import.
23. As a Landlord, I want unrelated accounts blocked from my records and images, so that isolation survives both API and direct backend access.
24. As an operator editing a Tenant, I want previews and deferred image removal to behave as before, so that migration does not change the editing workflow.
25. As a returning mobile or PWA user, I want obsolete sessions handled with a clean sign-in, so that stale cookies and cached records do not break or leak the new session.
26. As the deployer, I want production credentials separated from preview and browser configuration, so that administrative access cannot be exposed.
27. As the deployer, I want repeatable imports and reconciliation reports, so that interrupted steps can resume without duplicate records.
28. As the deployer, I want a rehearsed maintenance and recovery plan, so that cutover failures do not silently lose newly collected payments.
29. As the deployer, I want comparable latency measurements, so that changing providers does not conceal an API performance regression.
30. As the deployer, I want no runtime dependence on InsForge after completion, so that its shutdown does not interrupt the application.
31. As the deployer, I want database and file backups restorable independently of either dashboard, so that the new provider is not the only recovery mechanism.

## Implementation Decisions

### 1. Preserve the architecture

- Keep UI → TanStack Query → internal `/api` → authentication wrapper → service → repository → provider adapter. Do not introduce direct operational Supabase calls from UI components or move authorization into the browser.
- Keep API payloads, response envelopes, error semantics, query keys, invalidation behavior, loading/error states, and business permissions unless an explicitly documented security compatibility change is necessary.
- Introduce Supabase implementations behind existing boundaries. Extract provider-neutral business types and result/error contracts incrementally where they currently reside with InsForge code; avoid an unrelated whole-project rename or generic multi-provider framework.
- Replace provider-dependent sign-in/out, proxy/session handling, refresh, operational authentication, Staff administration, recovery, repositories, storage, and operational tooling. Routes and factories must select a coherent provider for each deployment.
- Each deployed environment uses one authoritative backend for Auth, data, and storage. No mixed InsForge-auth/Supabase-data production state, automatic provider fallback, or dual writes.
- Preserve financial rules, permission guards, ownership context, and tracing. Migration is not a business-logic rewrite.

### 2. Inventory and independent backups first

- Inspect the live source before choosing extraction tooling. Record project state, accessible export interfaces, database version/extensions, schema, policies, functions, triggers, indexes, table/account counts, and object inventory.
- Repository inspection identifies eight application tables: `app_users`, `rooms`, `tenants`, `tenant_cccd_images`, `contracts`, `utility_metrics`, `utility_pricing`, and `invoices`. Verify this against live resources and inventory any additional dependencies.
- Prefer an allowlisted PostgreSQL schema/data export when database access is available. Otherwise use fully paginated, retryable application-data extraction with completeness checks and separately captured schema definitions. An API export must not be assumed to include Auth hashes or file bytes.
- Export Auth identities and relevant confirmed/disabled state through supported administration. Determine whether password hashes can actually be exported and which algorithms/formats they use. Missing hashes must not block independent data/file backups.
- Download actual storage objects, including images referenced only by legacy Tenant URLs. Produce a manifest containing source bucket/key or locator, Tenant and owner identity, MIME type, byte size, and checksum.
- Record snapshot identity/time, row counts, per-owner/per-period financial totals, checksums, and failures. Protect personal information and credential/hash exports through restricted access and encryption. Do not commit backups/secrets or print them in logs.
- Rehearse restoration from the artifacts. A successful export command alone is not proof of recoverability.
- Do not clear source data, run the destructive historical billing import, overwrite all owner IDs, or apply production seeds as migration steps. Existing schema/migration history must be reconciled with live state.

### 3. Prepare an isolated Supabase target

- Confirm the hosted target project, region, plan, quotas, and recovery capabilities. Prefer a region near users and align the Vercel server region where feasible; measure rather than promise network improvements.
- Isolate rehearsal from production using a separate project or an equivalently isolated supported environment. Any additional cost requires owner approval.
- Apply reviewed versioned application migrations, preserving precision, nullability, defaults, enum/check semantics, constraints, indexes, triggers, and compatible required extensions.
- Never restore provider-owned schemas, roles, grants, Auth internals, or Storage internals over Supabase-managed `auth` and `storage`. Import identities and bytes through supported mechanisms.
- Document the Supabase URL and publishable key, server-only secret/admin key, migration-only database credentials, application origin/redirect allowlist, and mail configuration. Administrative secrets must never be public environment variables.
- Keep preview/production credentials distinct. Changed build-time public configuration requires a fresh Vercel build/deployment, not merely changing server environment values. No hardcoded credentials in tooling.

### 4. Preserve identities and accounting

- Preserve every application primary key, especially `app_users.id`, and all `owner_app_user_id` values, relationships, timestamps, Room floors, profile fields, monetary values, and statuses.
- Treat `app_users.auth_user_id` as the provider identity reference. Preserve Auth UUIDs only if supported import and source data permit it; otherwise create an audited one-to-one source-auth/target-auth mapping and update only the provider reference.
- Never confuse Auth UUIDs with application user UUIDs or assign ownership to the migration operator. Email alone is not authority to attach another account's records.
- Import in dependency order: Auth identities, application Landlords, owned Staff, Rooms, and dependent entities. Resolve self-referencing ownership and other foreign keys explicitly without leaving production constraints disabled.
- Verify exact ID sets and relationships, not only equal counts. Report missing, extra, orphaned, and cross-owner records; never silently discard invalid rows.
- Import stored Invoice snapshots, payments, discounts, fees, and debt notes exactly. Do not regenerate invoices or infer new charges from historical data.

### 5. Authentication and Staff provisioning

- Use documented Supabase JavaScript/SSR integration with separate request-bound server, browser-session, and administrative clients. Do not share mutable user sessions through a global client.
- Use supported verified-claims validation or a current-user lookup appropriate to signing configuration and revocation requirements. Cookie presence, decoded JWT content, and an unverified session object are not authorization proofs.
- Resolve active status, role, and ownership from trusted application-user records. Preserve centralized operational auth and fresh enforcement of disabled users and permission changes.
- If compatible hashes are available, rehearse secure import and controlled-account login before selecting password preservation. Documented external-provider imports do not establish InsForge-specific export compatibility.
- Otherwise provision target identities through supported administration and require verified password establishment through recovery. Never use common default passwords, ask for plaintext existing passwords, or depend on future InsForge availability for login.
- Preserve confirmed-email state only with source evidence. Do not auto-confirm all accounts or reactivate disabled application users.
- Disable public signup in application and provider settings. Preserve Landlord-managed Staff creation using an isolated administrative operation that does not replace the Landlord session.
- Assign Staff ownership and provide compensation/reconciliation if Auth creation succeeds but application-user creation fails. Retries must not duplicate identities or adopt unrelated accounts by email. Preserve current Staff update/delete semantics.
- Require reauthentication at cutover; remove obsolete InsForge cookies and clear account-specific client caches. InsForge tokens are not Supabase sessions.

### 6. OTP recovery and email delivery

- Preserve sign-in-page request OTP → verify OTP → new password for Landlord and Staff. Retain neutral request responses, throttling, expiry, and single-use protection without disclosing account existence.
- Configure recovery email templates for OTP, not an accidental signup/passwordless-login flow. Adapt Supabase verification/password-update semantics behind the existing application API contract.
- Provider OTP verification may establish a session. Isolate recovery credentials so verification does not grant operational access before reset completes. Bind proof to identity, purpose, and expiry.
- Keep reset authorization valid for at most ten minutes and reject replay. This is not authorization to introduce a new global ten-minute login-session policy.
- Replace process-local recovery/rate-limit state required for correctness with provider-verifiable or durable state suitable for multiple Vercel instances. Consecutive requests must not depend on reaching the same process.
- Configure custom SMTP or supported production email delivery. The default Supabase mail service is not a production plan for arbitrary user addresses. Prove receipt and completion with real controlled Landlord/Staff recipients before cutover; rehearsal must not send unsolicited bulk emails.

### 7. Database and storage authorization

- Review and port active-user, Landlord, and owner-resolution SQL helpers, RLS, grants, and ownership checks against Supabase identity. Preserve safe security-definer search paths and minimum execution privileges.
- Operational database requests use user identity and RLS. Restrict secret/admin-key access to justified administration and migration; do not bypass RLS for ordinary business operations to make integration pass.
- Preserve owner-scoped reads/creates, Staff create-only business permissions, and Landlord-only updates/deletes and administration. Guard create endpoints that could overwrite existing records.
- Validate ownership of referenced Rooms, Tenants, Contracts, and related rows, not just the inserted row's owner. Reject spoofed ownership and cross-account references.
- Verify both application API and direct backend requests with user credentials. Do not introduce anonymous table access or blanket authenticated-user access.
- Use a private CCCD bucket with owner/Tenant-bound read/upload/delete policies and existing role restrictions. Predictable object keys are not access control.

### 8. Move documents and normalize locators

- Copy inventoried image bytes and verify checksums, sizes, metadata, and links. Retries must not duplicate gallery records or skip images because an old URL is unavailable.
- Make durable bucket/object locators authoritative. Review schema/adapter compatibility for the existing non-null public-URL metadata and legacy front/back URLs; no required URL may remain dependent on retiring InsForge storage.
- Serve private images through short-lived signed URLs or an authenticated stream. Do not persist expiring signed URLs as permanent identifiers. Handle URL expiry without requiring profile edits.
- Preserve gallery API behavior, immediate local previews, and removal only on Save. Required storage failures must remain visible rather than be reported as a fully successful save.
- Protect CCCD backups/rehearsal access. Report missing objects and orphan metadata for explicit resolution before go-live instead of silently dropping attachments.

### 9. Observability and ongoing recovery

- Retain timing/error contracts and comparable Auth → Service → Repository → provider-request measurements. Distinguish cold/warm samples, deployment locations, payload sizes, and network/database work where measurable; label unavailable DB-internal timing honestly.
- Compare source/target warm p50 and p95 for list/detail, Dashboard, utility billing, and payment APIs. Review indexes and extra round trips; no fixed speedup is promised without measurements.
- Do not log tokens, cookies, passwords, OTPs, hashes, or document contents. Map provider failures into useful safe application errors.
- Define independent database/file backup retention, restricted access, ownership of operations, and plan-specific restore capabilities. Rehearse restoration after migration.
- Check Free-tier inactivity pausing, email limits, and backup access before choosing a plan. Do not promise unlimited or permanently unpaused free hosting.

### 10. Execution phases and exit gates

| Phase | Deliverable | Exit gate |
| --- | --- | --- |
| 0 — Rescue and inventory | Read-only inventory, protected data/Auth/file exports, manifests, restore procedure. | Artifacts independently readable/restorable before the Free shutdown; missing resources and password-transfer capability recorded. |
| 1 — Target foundation | Isolated Supabase, reviewed schema/RLS, configuration and SMTP. | Compatibility, credential restrictions, real mail delivery, and empty-account isolation pass. |
| 2 — Identity and access | Auth import/mapping, sessions, authorization, Staff administration, recovery. | Controlled logins, disabled-user rejection, recovery, and cross-owner denial pass with business IDs preserved. |
| 3 — Data and operational APIs | Repeatable data import and Supabase adapters for every implemented business slice. | IDs, relationships, financial reconciliation and API behavior pass, including payments, discounts, previous balances, exports and Dashboard periods. |
| 4 — Documents | Byte copy, private storage, legacy normalization, gallery integration. | Every attachment accounted for; checksums, display/upload/deferred-delete and access restrictions pass. |
| 5 — Full rehearsal | End-to-end rehearsal, latency comparison, maintenance estimate, recovery drill. | Reconciliation, email, measured latency and recovery accepted; no unresolved data/security blocker. |
| 6 — Production cutover | Authorized maintenance, source write freeze, final snapshot/import, deployment and smoke checks. | Final reconciliation passes; one authoritative backend; reauthentication/core workflows work before reopening writes. |
| 7 — Stabilize and retire | Monitoring, independent restore verification, dependency cleanup, credential retirement. | No runtime InsForge calls, required source-hosted images or source credentials; protected recovery artifacts remain usable. |

- Phases 3 and 4 can be developed in parallel after schema/identity prerequisites, but both block rehearsal and cutover. Each phase produces its evidence before downstream acceptance.
- Keep the production source authoritative until cutover. Rehearsal must not write to source, change real passwords, or send migration mail to all users.
- Freeze every source write entry point, not only the UI: APIs, account lifecycle, storage, scripts and direct provider access. Reconcile Auth changes and file bytes as well as data rows for the final consistent snapshot.
- Document maintenance and final sign-off. Deploy correct build/runtime configuration, invalidate obsolete sessions, and verify existing browsers/PWA installations.
- Before reopening target writes, reverting to source requires it to remain available with an unchanged snapshot. After target writes begin, freeze and reconcile them before rollback; never lose new payments/documents by restoring an older snapshot.
- Once Free source hosting stops, source rollback is unavailable. Recovery uses validated artifacts or target restore/repair. A paid InsForge bridge is an owner-approved contingency, never an automatic purchase or substitute for backup.
- Delay destructive source cleanup and irreversible credential retirement until stabilization/recovery gates pass. Do not delete business data merely to demonstrate independence.

## Testing Decisions

- The user approved `/api` as the primary acceptance seam, supplemented by browser login/OTP, CCCD uploads, and migrated-data reconciliation. Assert observable contracts and outcomes, not internal client-construction call counts.
- Reuse operational-auth/route, Staff lifecycle, repository/service, Invoice generation/payment/previous-balance, PDF/Excel, and TanStack Query/UI test patterns already present. Adapt provider fixtures without weakening behavior assertions.
- Unit/contract tests can simulate provider failures. At least one isolated real Supabase integration run must exercise Auth, RLS, relationships, file bytes, and recovery; mocked adapters cannot prove a working migration.
- Use two unrelated Landlords, owned Staff, a disabled identity, and a new empty account. Verify Staff allowed reads/creates, denied updates/deletes, Landlord isolation, permission changes, and anonymous rejection.
- Exercise direct backend table/storage access with user credentials too: API-only checks can hide permissive RLS or administrative-key bypasses.
- Compare exact primary-key sets, counts per table/owner, relationships, floors, profiles, utility periods and stored monetary values. Reconcile totals, payments and balances per owner/period using decimal-safe arithmetic, including discounts and fee/debt notes.
- Check every expected object against the manifest and display legacy/multi-image profiles. Test signed-link expiry, unauthorized access, previews, cancellation without deletion, and deletion/persistence only after Save.
- Validate supported hash import with controlled accounts where possible and independently test reset fallback. Cover wrong/expired/replayed OTP, throttling, multi-instance recovery, disabled accounts, disabled signup and no access through incomplete recovery.
- Exercise changed Auth UUID mapping with preserved application UUIDs, restartable imports, conflict detection and no duplicate users, image metadata, records or payments.
- Browser smoke tests cover login, allowed create/edit flows, meters, Invoice generation/payment, PDF/Excel, Dashboard periods, and mobile/PWA reauthentication. Assert preserved financial rules, not only successful HTTP responses.
- Rehearse cutover/recovery including target writes already existing and source unavailability. Compare production-like latency with a source baseline and record any accepted regression.
- Completion requires evidence reports, no unexplained reconciliation differences, no cross-account access, no runtime InsForge dependency, and an independently tested restore path.

## Out of Scope

- Implementing/running migration while authoring this spec; tickets are a subsequent step.
- UI redesign, new accounting rules, historical Invoice recalculation, new exports, or unrelated performance refactors.
- Implementing pending Staff activation or a forced ten-minute login session. Preserve implemented flows; reset-token validity is a separate concern.
- Public registration, a new permission model, self-hosted InsForge, continuing provider synchronization, dual writes, or zero-downtime guarantees.
- Automatic purchases/upgrades, unsolicited bulk mail, destructive source cleanup, or committed backups/credentials.
- Unused AI, functions or realtime features unless live inventory establishes a dependency; new dependencies require explicit scope review.

## Further Notes

- Repository findings establish application dependencies, not live completeness. Record live counts, hash-export capability, legacy/missing images, database access, target project/plan, SMTP and maintenance window during preparation rather than assuming them.
- Shutdown dates are from the user's email, not an independently verified status announcement. For this Free project, prioritize **export before December 7, 2026**, not March 2027.
- Supabase hash-import capability depends on an appropriate source export; no InsForge-specific compatibility guarantee is established. If unavailable, retain independent data/file backups and use verified recovery-based password establishment.
- The approved six-ticket breakdown is published alongside this spec with explicit blockers. Publishing those tickets does not perform a production migration.
- Official references consulted:
  - [PostgreSQL migration](https://supabase.com/kb/guides/migrate-from-postgres).
  - [External Auth migration/hash import](https://supabase.com/kb/guides/migrate-from-auth0) — capability reference, not an InsForge-specific procedure.
  - [Administrative user creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser) and [server-side Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client).
  - [API keys and privilege boundaries](https://supabase.com/docs/guides/api/api-keys).
  - [Recovery email templates](https://supabase.com/docs/guides/auth/auth-email-templates) and [production SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
  - [Storage access control](https://supabase.com/docs/guides/storage/security/access-control) and [private downloads](https://supabase.com/docs/guides/storage/serving/downloads).
  - [Production readiness](https://supabase.com/docs/guides/deployment/going-into-prod) and [regions](https://supabase.com/docs/guides/platform/regions).
