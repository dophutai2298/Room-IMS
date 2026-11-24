# InsForge rescue runbook

Use this before the Free project stop date stated in the owner's email: **7 December 2026**. The command reads the hosted source without changing it. It exports the eight application tables, SQL schema and data, migration history, non-anonymous Auth users, every listed Storage object, and any separate legacy Tenant image URLs that are still reachable.

## Create an encrypted archive

Set `RESCUE_BACKUP_PASSPHRASE` to a private passphrase of at least 20 characters in the local `.env`. Do not paste it into chat, commit it, or store it beside the archive in another backup location. The existing InsForge URL and server API key must also be available in `.env`.

From the project root in PowerShell:

```powershell
npm.cmd run data:rescue-insforge
```

The command prints the path of a new `.enc` file under `.scratch/insforge-rescue/`, aggregate row/file counts, and the number of reconciliation issues. This directory is ignored by Git. Copy the encrypted archive to a second, independent location before relying on it. The command refuses to overwrite an existing archive.

If legacy CCCD URLs use a host other than the InsForge project host, set `RESCUE_EXTRA_ASSET_HOSTS` to a comma-separated list of trusted hostnames and rerun. Only allowlist hosts that actually hold the application's own files.

## Verify or restore

Use the exact archive path printed by the rescue command:

```powershell
npm.cmd run data:verify-insforge-rescue -- .scratch/insforge-rescue/<archive-name>.enc
```

Verification decrypts the archive, checks table ID sets and per-owner counts, foreign keys, Invoice totals, and every saved object's size and SHA-256 digest. Exit status is nonzero when the archive contains unresolved source-data issues, even if its encrypted contents are intact. Full explanations remain in the encrypted manifest.

To recover the SQL, JSON rows, Auth metadata, and original file bytes into a **new**, isolated, protected directory, run the following only on a trusted machine. Extraction refuses an existing destination. The extracted files are plaintext and contain personal information; on Windows, check the destination's NTFS ACL before allowing other users onto the machine:

```powershell
$env:RESCUE_ALLOW_PLAINTEXT_RESTORE = 'true'
node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --env-file=.env --experimental-strip-types scripts/rescue-insforge.ts --extract .scratch/insforge-rescue/<archive-name>.enc .scratch/insforge-restore-test
Remove-Item Env:RESCUE_ALLOW_PLAINTEXT_RESTORE
```

The resulting `data.sql` is the unmodified source export; `schema.sql` is its DDL export. InsForge's admin SQL export omits primary keys and emits policies/triggers before their functions. The extracted `data-restorable.sql` adds the eight known `id` primary keys and merges its duplicate Contract trigger declarations. These changes are only for the isolated restore drill; they do **not** claim to reconstruct every source constraint. Use `scripts/insforge-rescue-restore-bootstrap.sql` to provide the source-specific `authenticated` role and temporary `auth.uid()`/policy/trigger functions. The export replaces the temporary public functions at its end. Never run either SQL file against production InsForge or an existing Supabase project. The `rows/` files are a second, paginated data copy; `objects/` contains Storage bytes, and `legacy/` separately downloaded legacy image bytes.

To repeat the PostgreSQL 16 drill with Docker Desktop, choose a fresh container name and database; do not reuse an existing application database:

```powershell
docker run -d --name rentalroom201-rescue-check --network none -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine
docker exec rentalroom201-rescue-check pg_isready -U postgres
docker cp scripts/insforge-rescue-restore-bootstrap.sql rentalroom201-rescue-check:/tmp/bootstrap.sql
docker cp .scratch/insforge-restore-test/data-restorable.sql rentalroom201-rescue-check:/tmp/data.sql
docker exec rentalroom201-rescue-check psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/bootstrap.sql
docker exec rentalroom201-rescue-check psql -v ON_ERROR_STOP=1 -U postgres -d postgres -f /tmp/data.sql
node --experimental-strip-types scripts/verify-insforge-restore.ts .scratch/insforge-restore-test rentalroom201-rescue-check postgres
```

Wait until `pg_isready` reports that connections are accepted before running the two `psql` commands. The container has no network or published port; `trust` authentication is acceptable **only** for that disposable, isolated drill. The verifier compares every restored row and field, table ID set, count and per-owner count, each owner/period Invoice total/paid/outstanding amount, and the SHA-256/size of every extracted file. Remove the container and plaintext extraction after the drill; retain the encrypted archive and copy it to independent storage with the passphrase kept separately.

The 24 November 2026 drill restored to a fresh PostgreSQL 16 database and returned `restored-and-reconciled`: every field in eight tables, 26 Invoice owner/period groups, and five file checksums matched. This proves data recoverability, not complete behavioral equivalence with InsForge or Supabase.

The InsForge Auth list endpoint does not provide password hashes, anonymous identities or project-admin accounts. Those must be evaluated separately for the migration; this archive preserves the exposed user IDs, email verification state and application-user mapping. API pagination and the SQL export are not one atomic transaction while source writes continue. Repeat the export after writes are frozen for the final cutover and compare manifests.

The live source currently has **five CCCD Storage objects but zero `tenant_cccd_images` records**; no object key starts with an existing Tenant ID and no legacy front/back URLs are present. The bytes are preserved, and each object's Tenant/owner fields in the latest manifest are explicitly `null`, because there is no trustworthy mapping. The `tenant-cccd-images` bucket is marked public by InsForge. Treat both findings as a **no-go for automatically attaching images** during migration. Resolve their ownership with the Landlord or leave them quarantined/private in Supabase; do not guess from filenames. The exact object locators and checksums are inside the encrypted manifest, not this repository.

The live source's admin export covers the eight expected application tables and includes 10 migration records, 14 exported indexes, 30 RLS policies and four functions. Direct PostgreSQL connection, system-catalog enumeration, exact server version/extensions and password-hash export were not available through the credentials used here. The original admin SQL export also omits at least primary keys and cannot be treated as a complete provider-to-provider schema migration. Use the project's schema migrations and a separate Supabase schema review in ticket 02.

The archive is AES-256-GCM encrypted with a key derived from the passphrase and a random salt. The format also authenticates its bytes, so a wrong passphrase or modified file fails verification. Keep the passphrase safe: without it, recovery is not possible.
