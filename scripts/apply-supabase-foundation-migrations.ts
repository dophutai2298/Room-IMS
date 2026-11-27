/** Ticket 02 migrations. Usage: --check | --apply <exact-project-ref>. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

import { validateSupabaseMigrationTarget } from "../src/lib/supabase/migration-target";

const migrationFiles = [
  "202611240001_foundation.sql",
  "202611240002_password_reset.sql",
  "202611240003_identity_migration_audit.sql",
] as const;

const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const databaseUrl = process.env.SUPABASE_DB_URL;
if (!publicUrl || !databaseUrl) throw new Error("Supabase URL and SUPABASE_DB_URL are required.");
const projectRef = validateSupabaseMigrationTarget(publicUrl, databaseUrl);
const [mode, confirmation] = process.argv.slice(2);
if (mode !== "--check" && (mode !== "--apply" || confirmation !== projectRef)) {
  throw new Error("Use --check, or --apply followed by the exact Supabase project ref.");
}

const client = new pg.Client({
  connectionString: databaseUrl,
  ssl: {
    ca: readFileSync(path.join(process.cwd(), "supabase", "certs", "prod-ca-2021.crt"), "utf8"),
    rejectUnauthorized: true,
  },
  connectionTimeoutMillis: 8_000,
  query_timeout: 30_000,
  application_name: "rentalroom201-foundation-migration",
});

async function migrationDigest(file: string) {
  const sql = await readFile(path.join(process.cwd(), "supabase", "migrations", file), "utf8");
  return { sql, digest: createHash("sha256").update(sql).digest("hex") };
}

async function main() {
  await client.connect();
  const identity = await client.query<{ database: string; auth_user: string }>(
    "select current_database() as database, current_user as auth_user",
  );
  if (identity.rows[0]?.database !== "postgres") throw new Error("Refusing non-postgres database.");

  const ledger = await client.query<{ exists: string | null }>(
    "select to_regclass('public._app_migrations')::text as exists",
  );
  const publicTables = await client.query<{ table_name: string }>(
    "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name",
  );
  const authCount = await client.query<{ count: string }>(
    "select count(*)::text as count from auth.users",
  );
  const recorded = ledger.rows[0]?.exists
    ? await client.query<{ name: string; sha256: string }>(
        "select name, sha256 from public._app_migrations order by name",
      )
    : { rows: [] };
  const applied = new Map(recorded.rows.map((row) => [row.name, row.sha256]));

  for (const file of migrationFiles) {
    const { digest } = await migrationDigest(file);
    const previous = applied.get(file);
    if (previous && previous !== digest) {
      throw new Error(`Applied migration ${file} differs from the local file. Stop and reconcile.`);
    }
  }

  if (mode === "--check") {
    console.log(JSON.stringify({ projectRef, database: "postgres", mode,
      publicTables: publicTables.rows.map((row) => row.table_name),
      authUserCount: Number(authCount.rows[0]?.count ?? 0),
      migrations: migrationFiles.map((file) => ({ name: file, applied: applied.has(file) })) }));
    return;
  }

  if (!ledger.rows[0]?.exists && publicTables.rows.length > 0) {
    throw new Error("Target has public tables but no migration ledger. Stop and review before applying.");
  }

  await client.query("begin");
  try {
    await client.query("select pg_advisory_xact_lock(201, 20261124)");
    await client.query(`
      create table if not exists public._app_migrations (
        name text primary key,
        sha256 text not null,
        applied_at timestamptz not null default now()
      )`);
    await client.query("alter table public._app_migrations enable row level security");
    await client.query("revoke all on public._app_migrations from public, anon, authenticated");

    // Re-read under the advisory lock to protect against a concurrent runner.
    const locked = await client.query<{ name: string; sha256: string }>(
      "select name, sha256 from public._app_migrations order by name",
    );
    const current = new Map(locked.rows.map((row) => [row.name, row.sha256]));
    for (const file of migrationFiles) {
      const { sql, digest } = await migrationDigest(file);
      const previous = current.get(file);
      if (previous) {
        if (previous !== digest) throw new Error(`Migration checksum changed: ${file}`);
        continue;
      }
      await client.query(sql);
      await client.query("insert into public._app_migrations(name, sha256) values($1, $2)", [file, digest]);
      console.log(`Applied ${file}`);
    }
    await client.query("select pg_notify('pgrst', 'reload schema')");
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
  console.log(JSON.stringify({ projectRef, database: "postgres", mode, applied: migrationFiles.length }));
}

void (async () => {
  try {
    await main();
  } catch (error) {
    // Never print a database URL, password or arbitrary driver error detail.
    const code = typeof error === "object" && error && "code" in error
      ? String(error.code) : "MIGRATION_FAILED";
    const safeMessage = code === "MIGRATION_FAILED" && error instanceof Error
      ? error.message : "Database connection or SQL failed; check code.";
    console.error(JSON.stringify({ code, message: safeMessage }));
    process.exitCode = 1;
  } finally {
    await client.end().catch(() => undefined);
  }
})();
