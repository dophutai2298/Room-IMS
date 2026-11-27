# Ticket 04 — Supabase billing migration

The billing slice remains opt-in. `APP_BACKEND=insforge` is still the default; do not change production traffic until the full migration rehearsal and cutover tickets are accepted. The target must be the isolated Supabase project already initialized by tickets 02 and 03. Never paste the database URL or secret key into a log or chat.

## Apply and reconcile

With the verified ticket 01 snapshot extracted under `.scratch/supabase-foundation-extracted` and Supabase values in local `.env`:

1. `npm run data:migrate-supabase-foundation -- --check`
2. `npm run data:migrate-supabase-foundation -- --apply <exact-project-ref>`
3. `npm run data:import-supabase-ticket04 -- .scratch/supabase-foundation-extracted --validate`
4. `npm run data:import-supabase-ticket04 -- .scratch/supabase-foundation-extracted --dry-run`
5. `npm run data:import-supabase-ticket04 -- .scratch/supabase-foundation-extracted --apply <exact-project-ref>`
6. Repeat step 5 to check idempotence and exact ID/field/financial reconciliation.

The import checks the rescue manifest SHA-256 and source owner/Room/period links before writing. It inserts only missing IDs and rejects conflicts; it never regenerates an old Invoice or overwrites payment state. Decimal comparisons use integer cents. In the verified snapshot, 91 older Invoices have a nullable `discount_amount`. Migration `202611270003_legacy_invoice_discount_null.sql` preserves these nulls; the UI displays them as zero discount. This is a source-data distinction, not a recalculated amount.

## Acceptance

Run `npm run data:verify-supabase-ticket04` for rolled-back RLS checks. For a live API probe, start an isolated local app with `APP_BACKEND=supabase`, set `TICKET04_API_ORIGIN=http://localhost:<port>`, then run `npm run data:probe-supabase-ticket04-api -- --apply <exact-project-ref>`. The probe uses temporary confirmed Auth users and removes all of its test data afterward; verify the source counts again with the importer. It exercises selected-period metrics, pricing history, Contract price override, 62,500 VND discount, partial payment, editable next-period carry-forward, Staff update denial, cross-owner list/PDF denial, and a usable PDF. The Excel generator already consumes the same `/api/invoices` list response and is covered by the existing export behavior tests.

Before production cutover, finish tickets 02 and 03's real-account/SMTP and browser-gallery acceptance, then manually inspect the billing pages in a browser for loading, retry, cache invalidation, PDF and Excel downloads. Ticket 05 owns the full rehearsal; ticket 06 owns production cutover.
