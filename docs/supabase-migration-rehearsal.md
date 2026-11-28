# Ticket 05: Dashboard and migration rehearsal

This is a **staged-target** record, not permission to switch production. The source remains InsForge unless ticket 06 explicitly cuts over. The protected source export and extracted directory contain personal data; keep them outside Git and use only on a trusted workstation. Administrative Supabase credentials appear only in guarded import/probe scripts, never operational `/api` routes.

## Repeatable steps

1. Verify the encrypted rescue archive using `data:verify-insforge-rescue`. Inspect its issue summary before proceeding. The 24 November archive verifies cryptographically but exits nonzero for five unlinked test CCCD objects; there are no missing file bytes or other reported issues. Per owner instruction these files are not attached to any Tenant. Do not silently drop new or linked objects in a later export.
2. Use the protected, already extracted ticket-01 snapshot. Apply versioned Supabase migrations to a **separate, empty project** with an exact project-ref guard. The current rehearsal target was not empty, so a full fresh-project run is still required.
3. Run `data:import-supabase-foundation`, `data:import-supabase-ticket03`, then `data:import-supabase-ticket04` with the extraction directory, `--apply`, and the exact isolated project ref. Never run them against the InsForge source. Run them twice; a repeat must create no duplicate Auth/application rows and must reconcile every row/file.
4. Run `npm run data:verify-supabase-foundation -- <extracted-directory>`, `npm run data:verify-supabase-ticket03`, `npm run data:verify-supabase-ticket04`, and `npm run data:verify-supabase-ticket05 -- <extracted-directory>`. The ticket-05 verifier is read-only, uses a certificate-verified DB connection, compares the exact eight table ID sets and per-owner counts, validates Auth mapping and foreign-owner links, compares integer-cent billed/paid/outstanding by owner/Room/period, and downloads every linked CCCD image to compare locator, length and SHA-256. Missing **or extra** rows fail.
5. Start a localhost app with `APP_BACKEND=supabase`, set `TICKET03_API_ORIGIN` and `TICKET05_API_ORIGIN` to that localhost origin, then run `npm run data:probe-supabase-ticket03-storage -- --apply <project-ref>` and `npm run data:probe-supabase-ticket05-dashboard -- --apply <project-ref>`. These create temporary, confirmed `example.test` Auth users; they send no email to real users. They remove their temporary data after the probe. Re-run reconciliation after cleanup. Ticket 04's API probe covers pricing, billing/payment, PDF and cross-owner denial.
6. On an independently provisioned fresh target, complete real-account browser sign-in, OTP, Staff lifecycle, gallery preview/cancel/deferred delete, Contract, billing, PDF/Excel, Dashboard month/range/Brush and PWA reauthentication checks. Record artifacts without credentials, OTPs, document bytes or private URLs.

## Evidence from 28 November 2026

The source archive verification reported two Auth users, eight tables, five saved unlinked Storage objects, and exactly five known unlinked-object issues. The existing target repeat import took about 3.3 s (Foundation), 5.8 s (Tenant/Contract) and 34 s (Billing); Foundation created zero duplicate Auth/application/Room rows. This **does not measure a clean import or production downtime**. Ticket-05 reconciliation before and after temporary API/Storage probes returned `reconciled`: 2 `app_users`, 4 Rooms, 10 Tenants, 0 linked CCCD rows, 10 Contracts, 101 Utility Metrics, 2 Utility Pricing rows, 101 Invoices, 2 Auth mappings and 101 financial groups. All ID sets, owner counts, links and per-period money matched. The linked-file checksum branch has no historical file to exercise; the Storage probe used a temporary private image and confirmed owner/Staff access and cross-owner/anonymous denial.

The Dashboard API probe passed for two unrelated Landlords, owned Staff, a disabled user and a new empty Landlord. It checked availability, missing-meter and unpaid-Invoice reminders, August/September 2026 and current-year/all revenue, plus a partially paid Invoice. All four `/api/dashboard/*` routes returned user-scoped Supabase data and `repository.supabase` timing spans; `/api/rooms` remained the availability source. Foundation, Tenant/Contract and Billing RLS verifiers passed in rolled-back transactions; direct Storage access passed with four user tokens. No real user was emailed or signed in during this rehearsal.

## Warm latency comparison

Both runs used five warm samples per endpoint, but they are **not apples-to-apples**: the InsForge source values are from `.scratch/performance/after.json` (20 August, localhost:3100) and `after-diagnostics.json` for the Dashboard summary (20 samples); Supabase values are from a localhost:3105 **development** server with temporary test data. Payloads differ, source region and cold-start state are not recorded; Supabase pooler hostname suggests `ap-northeast-1`, but project region/plan still needs owner confirmation. The latest `api-baseline-latest.json` is all HTTP 401 and is not a valid operational baseline. No source payment sample exists.

| Endpoint | InsForge warm p50/p95 ms | Supabase warm p50/p95 ms | Supabase median payload |
| --- | ---: | ---: | ---: |
| Rooms list | 188/190 | 558/1033 | 993 B |
| Room detail | 202/462 | 801/909 | 1,014 B |
| Dashboard operations summary | 172/675 (20 samples) | 701/841 | 1,795 B |
| Dashboard revenue | 170/250 | 516/559 | 1,701 B |
| Invoices list | 161/168 | 521/588 | 1,298 B |
| Invoice payment | no source sample | 858/886 | 1,005 B |

Supabase request spans put operational Auth near 0.32–0.48 s p50 and the Dashboard repository near 0.15–0.25 s p50; payment read/write were about 0.15/0.33 s p50. The new path is **not proven faster**; repeat under equivalent build, data, region and authenticated sample conditions before setting a performance go/no-go threshold. No secrets or document contents were logged.

## Recovery rehearsal and cutover gate

- **Before target writes:** keep InsForge authoritative. A failed target import is recoverable by leaving `APP_BACKEND=insforge`; repair or recreate the isolated target from the verified archive. Ticket 01 already demonstrated a fresh PostgreSQL 16 restore of source SQL and bytes, but a fresh Supabase project restore has not been run.
- **After target writes:** never simply flip back to an older InsForge snapshot. Freeze target writes, export and encrypt newly created payments, invoices, documents and Auth mappings, compare their IDs/timestamps/checksums with both systems, and resolve overlaps before replay. Test this on a fresh project before relying on it; no automated reverse-sync exists yet. Preserve the target backup until every new write has been accounted for.
- **If InsForge is unavailable:** the encrypted 24 November archive provides a known recoverable point, not guaranteed current data. Keep an intact target copy; compare it with the last verified source snapshot and preserve post-snapshot writes. If either copy is incomplete, hold writes and do not claim lossless recovery.
- **Expected downtime:** not yet estimable. The ~43 s idempotent repeat on an already populated target excludes write freeze, fresh export, network transfer, Auth activation, browser checks and deploy. Ticket 06 must time a clean rehearsal and agree a maximum outage before cutover.

**Go/no-go: NO-GO.** Open dependencies: ticket 02's SMTP, real imported-account credential and browser acceptance; ticket 03's browser gallery and historical linked-file test; a second empty Supabase project for a clean end-to-end run; a tested post-write recovery/delta preservation path; and an equivalent performance comparison. The five unlinked CCCD test objects are a known, explicitly excluded source gap, not an invented Tenant relationship. None of these gates should be hidden by passing automated tests.
