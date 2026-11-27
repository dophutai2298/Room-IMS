/** Validate the DB URL without ever logging its credentials. */
export function validateSupabaseMigrationTarget(publicUrl: string, databaseUrl: string): string {
  let api: URL;
  let db: URL;
  try {
    api = new URL(publicUrl);
    db = new URL(databaseUrl);
  } catch {
    throw new Error("Supabase project or database URL is invalid.");
  }
  const projectRef = api.hostname.match(/^([a-z0-9-]+)\.supabase\.co$/)?.[1];
  const direct = db.hostname === `db.${projectRef}.supabase.co`
    && decodeURIComponent(db.username) === "postgres";
  const pooler = db.hostname.endsWith(".pooler.supabase.com")
    && decodeURIComponent(db.username) === `postgres.${projectRef}`;
  if (!projectRef || api.protocol !== "https:" || db.protocol !== "postgresql:"
      || (!direct && !pooler) || db.pathname !== "/postgres"
      || !db.password || !db.port || decodeURIComponent(db.password).includes("YOUR-DATABASE-PASSWORD")) {
    throw new Error("SUPABASE_DB_URL must target the configured hosted Supabase project with a real password.");
  }
  return projectRef;
}
