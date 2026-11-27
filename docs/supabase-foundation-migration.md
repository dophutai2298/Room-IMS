# Ticket 02 — isolated Supabase foundation

This is a **staged migration**, not a production cutover. Keep `APP_BACKEND=insforge` in the existing deployment. The Supabase branch covers Auth, Staff, password recovery and Rooms; Tenant, Contract, Utility, Invoice and Dashboard migration remains in tickets 03–05. Unmigrated `/api` routes return 503 and unmigrated pages redirect to Rooms on the isolated deployment; the Room UI labels related counts as not yet reconciled. Extend the route allowlist only as each later slice migrates. Do not direct production users to this branch yet.

## Target and credentials

Use a separate hosted Supabase project. Record its project ref, region, plan and the person responsible for its credentials in the private migration record. Set the following only in local `.env` and the isolated deployment's secret manager:

- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: project URL and browser-safe publishable key.
- `SUPABASE_SECRET_KEY`: secret API key, **server only**. Never use it for ordinary Room/Staff reads or writes; it is reserved for Auth provisioning, recovery and controlled import.
- `SUPABASE_DB_URL`: PostgreSQL connection string used only when applying migrations. Replace `[YOUR-DATABASE-PASSWORD]` with the real database password and URL-encode special characters. Direct connection requires IPv6 connectivity; use the **Session pooler** connection string from Connect if the machine cannot reach the direct host. Its hostname and username differ from Direct.

Do not put any real credential, Auth cookie, extracted backup or CCCD image into Git or a ticket. `SUPABASE_DB_URL` is not used at app runtime. The existing InsForge backup stays encrypted and separate from target credentials.

The guarded migration and verification scripts validate TLS using the public Supabase Root 2021 CA pinned at `supabase/certs/prod-ca-2021.crt` (source: [Supabase certificate download](https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt)). Do not disable certificate verification to work around `SELF_SIGNED_CERT_IN_CHAIN`. Supabase documents the Session pooler and CA/`verify-full` setup in its [Postgres SSL guide](https://supabase.com/docs/guides/platform/ssl-enforcement). Review certificate rotation if Supabase replaces this CA.

## Apply the application schema

Apply these three files in numeric order to the **isolated target only** using the guarded migration command below. It checks that the DB URL belongs to the same project as `NEXT_PUBLIC_SUPABASE_URL`, requires the exact project ref for writes, records SHA-256 digests, and runs all outstanding SQL in one transaction. `--check` is read-only. Use the Supabase SQL Editor only if native PostgreSQL connectivity is unavailable; if you do so, record the applied files and reconcile them with the command ledger before any retry.

1. `supabase/migrations/202611240001_foundation.sql` — application tables, grants, RLS and owner/role helpers.
2. `supabase/migrations/202611240002_password_reset.sql` — durable rate limit and single-use recovery proof.
3. `supabase/migrations/202611240003_identity_migration_audit.sql` — server-only source-to-target Auth mapping.

```powershell
npm.cmd run data:migrate-supabase-foundation -- --check
npm.cmd run data:migrate-supabase-foundation -- --apply <exact-target-project-ref>
npm.cmd run data:migrate-supabase-foundation -- --check
```

Do not restore InsForge `auth` or `storage` schemas into Supabase. Review each SQL file before applying. The files are intentionally limited to application-owned objects. Their policies are **not** re-runnable without the migration ledger; stop and inspect any failed or manually applied migration rather than blindly rerunning it. Direct PostgreSQL DNS may not resolve on IPv4-only networks; in that case copy the **Session pooler** string from the same project's Connect dialog. Do not manufacture its hostname or username from the Direct string.

In Supabase Dashboard → Authentication, disable public signups. Configure a production-capable custom SMTP sender and its domain/DNS records. Set email OTP expiry to **600 seconds or less** and use an email recovery template that displays `{{ .Token }}` so the existing six-digit input can be used. Test actual delivery to both a Landlord and a Staff mailbox. Do not mark email recovery done based on an API success alone. Rate limits and email deliverability are provider settings that must be reviewed separately from the application cooldown.

## Import preserved IDs

Start from the encrypted ticket-01 archive. On a trusted machine, extract it into a protected, disposable directory by following `docs/insforge-rescue.md`. The import reads only `auth-users.json`, `rows/app_users.json`, `rows/rooms.json` and `manifest.json`. The five unlinked test CCCD files are **not** imported or attached by this ticket.

```powershell
$env:RESCUE_ALLOW_PLAINTEXT_RESTORE = 'true'
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file=.env --experimental-strip-types scripts/rescue-insforge.ts --extract .scratch/insforge-rescue/<archive-name>.enc .scratch/supabase-foundation-extracted
Remove-Item Env:RESCUE_ALLOW_PLAINTEXT_RESTORE

npm.cmd run data:import-supabase-foundation -- .scratch/supabase-foundation-extracted --validate
npm.cmd run data:import-supabase-foundation -- .scratch/supabase-foundation-extracted --dry-run
npm.cmd run data:import-supabase-foundation -- .scratch/supabase-foundation-extracted --apply <exact-target-project-ref>
npm.cmd run data:import-supabase-foundation -- .scratch/supabase-foundation-extracted --apply <exact-target-project-ref>
npm.cmd run data:verify-supabase-foundation -- .scratch/supabase-foundation-extracted
```

The importer validates manifest ID sets, email/owner relationships and target project ref. It creates random, unknown per-user passwords, preserves `app_users.id`, Room IDs and ownership, and records each old/new Auth ID pair. Only source-verified email addresses are marked verified; no shared default password is issued. Imported accounts start with `credential_ready=false`; even a Supabase recovery-token session cannot read operational data through RLS. Existing users must establish a known password through the verified OTP recovery path, which marks the application mapping ready only after the Auth password update succeeds. The import stops on conflicting target rows or an unrelated pre-existing email; it never silently adopts one. A clean retry uses the audit mapping. Do **not** reset or delete target users to make a conflict disappear without investigating it.

The second `--apply` should report zero newly created rows. The verification command compares imported Auth mappings, application users and Rooms, then probes owner isolation and Staff Room permissions in a PostgreSQL transaction that is always rolled back. It does not send OTP or prove a browser login; those remain separate acceptance steps.

Keep the extracted plaintext directory private; remove it after reconciliation using the documented backup/retention process. Do not remove the encrypted archive. Ticket 01 still requires an independent encrypted copy before production cutover.

## Isolated acceptance and rollback boundary

Set `APP_BACKEND=supabase` **only** on the isolated deployment. Confirm that a new, unrelated Landlord has zero Rooms, imported Landlords see only their own Rooms, and owned Staff can list/create but cannot update/delete. Test anonymous and cross-owner access against Supabase REST with the user's own token, not the secret key. Test both browser and internal `/api` flows for sign-in, Room create/read/update, Staff create/read/update/disable, OTP request/exchange/complete and sign-out; check inactive accounts and expired/replayed OTPs. Verify source and target Room/app-user ID sets, ownership, floors, rent and maintenance state. A disabled account must not gain operational access through either the UI or API.

If any acceptance check fails, leave production on InsForge and correct the isolated target. This ticket does not switch traffic, write to InsForge, or claim that the other six application tables are migrated. The encrypted source archive remains the recovery point for source data; target changes must be documented so they can be replayed or discarded safely.
