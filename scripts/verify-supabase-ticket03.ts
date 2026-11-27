/** Transactional RLS rehearsal. Rolls back temporary credential-ready flags. */
import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { validateSupabaseMigrationTarget } from "../src/lib/supabase/migration-target";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const databaseUrl = process.env.SUPABASE_DB_URL;
if (!url || !databaseUrl) throw new Error("Supabase connection configuration missing");
const projectRef = validateSupabaseMigrationTarget(url, databaseUrl);
const db = new pg.Client({
  connectionString: databaseUrl,
  ssl: { ca: readFileSync(path.join(process.cwd(), "supabase/certs/prod-ca-2021.crt"), "utf8"), rejectUnauthorized: true },
  connectionTimeoutMillis: 8000,
  query_timeout: 30000,
  application_name: "rentalroom201-ticket03-rls-rehearsal",
});

async function main() {
  await db.connect();
  await db.query("begin");
  try {
    const users = await db.query<{ id: string; auth_user_id: string }>(
      "select u.id,u.auth_user_id from public.app_users u where u.role='landlord' order by (select count(*) from public.tenants t where t.owner_app_user_id=u.id) desc, u.id",
    );
    if (users.rows.length < 2) throw new Error("Two unrelated Landlords are required");
    const [a, b] = users.rows;
    const tenant = await db.query<{ id: string; owner_app_user_id: string }>(
      "select id,owner_app_user_id from public.tenants where owner_app_user_id=$1 limit 1", [a.id],
    );
    if (!tenant.rows[0]) throw new Error("Owner A has no Tenant to verify");
    const room = await db.query<{ id: string }>("select id from public.rooms where owner_app_user_id=$1 limit 1", [a.id]);
    if (!room.rows[0]) throw new Error("Owner A has no Room to verify");
    const bucket = await db.query<{ public: boolean }>("select public from storage.buckets where id='tenant-cccd-private'");
    if (bucket.rows.length !== 1 || bucket.rows[0].public) throw new Error("CCCD bucket must be private");
    const policies = await db.query<{ policyname: string }>(
      "select policyname from pg_policies where schemaname='storage' and tablename='objects' and policyname like 'tenant_documents_%'",
    );
    if (policies.rows.length !== 3) throw new Error("Storage read/create/delete policies missing");
    await db.query("update public.app_users set credential_ready=true where id=any($1::uuid[])", [[a.id,b.id]]);
    await db.query("set local role authenticated");
    for (const [self, other] of [[a,b],[b,a]]) {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [self.auth_user_id]);
      const tenants = await db.query<{ owner_app_user_id: string }>("select owner_app_user_id from public.tenants");
      const contracts = await db.query<{ owner_app_user_id: string }>("select owner_app_user_id from public.contracts");
      const foreignTenant = await db.query("select id from public.tenants where owner_app_user_id=$1", [other.id]);
      const canRead = await db.query<{ allowed: boolean }>("select public.can_access_tenant_document($1,$2) as allowed", [a.id, tenant.rows[0].id]);
      const cannotRead = await db.query<{ allowed: boolean }>("select public.can_access_tenant_document($1,$2) as allowed", [other.id, tenant.rows[0].id]);
      if (tenants.rows.some((r) => r.owner_app_user_id !== self.id)
        || contracts.rows.some((r) => r.owner_app_user_id !== self.id)
        || foreignTenant.rows.length
        || cannotRead.rows[0].allowed
        || (self.id === a.id && !canRead.rows[0].allowed)) throw new Error("Owner isolation RLS failed");
    }
    await db.query("select set_config('request.jwt.claim.sub','',true)");
    const anonymous = await db.query("select id from public.tenants");
    if (anonymous.rows.length) throw new Error("No-auth subject can read Tenant rows");
    await db.query("set local role postgres");
    await db.query("update public.app_users set role='staff',owner_app_user_id=$1 where id=$2", [a.id,b.id]);
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [b.auth_user_id]);
    const staffRead = await db.query("select id from public.tenants where id=$1", [tenant.rows[0].id]);
    const staffInsert = await db.query<{ id: string }>(
      "insert into public.tenants(room_id,full_name,owner_app_user_id) values($1,'Ticket 03 RLS probe',$2) returning id",
      [room.rows[0].id,a.id],
    );
    const staffUpdate = await db.query("update public.tenants set full_name='Should not update' where id=$1", [tenant.rows[0].id]);
    const staffDelete = await db.query("delete from public.tenants where id=$1", [tenant.rows[0].id]);
    const staffStorageDelete = await db.query<{ allowed: boolean }>(
      "select public.can_delete_tenant_document($1,$2) as allowed", [a.id,tenant.rows[0].id],
    );
    if (staffRead.rows.length !== 1 || staffInsert.rows.length !== 1 || staffUpdate.rowCount || staffDelete.rowCount || staffStorageDelete.rows[0].allowed)
      throw new Error("Staff create-only policy failed");
    console.log(JSON.stringify({ projectRef, landlords: users.rows.length, tenantAndContractRls: "pass", staffCreateOnlyRls: "pass", storagePolicy: "pass", mode: "transaction-rolled-back" }));
  } finally {
    await db.query("rollback");
  }
}

void main().catch((error) => {
  const code = typeof error === "object" && error && "code" in error ? String(error.code) : "ASSERTION";
  const message = code === "ASSERTION" && error instanceof Error ? error.message : "Database check failed";
  console.error(JSON.stringify({ code, message }));
  process.exitCode = 1;
})
  .finally(() => db.end().catch(() => undefined));
