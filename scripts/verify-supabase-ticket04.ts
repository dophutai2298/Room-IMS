/** Ticket 04 RLS rehearsal. All temporary changes are rolled back. */
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
  application_name: "rentalroom201-ticket04-rls-rehearsal",
});
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  await db.connect();
  await db.query("begin");
  try {
    const users = await db.query<{ id: string; auth_user_id: string }>(
      "select u.id,u.auth_user_id from public.app_users u where u.role='landlord' order by (select count(*) from public.invoices i where i.owner_app_user_id=u.id) desc,u.id",
    );
    assert(users.rows.length >= 2, "Two unrelated Landlords are required");
    const [owner, other] = users.rows;
    const room = await db.query<{ id: string }>("select id from public.rooms where owner_app_user_id=$1 limit 1", [owner.id]);
    const invoice = await db.query<{ id: string }>("select id from public.invoices where owner_app_user_id=$1 limit 1", [owner.id]);
    const pricing = await db.query<{ id: string }>("select id from public.utility_pricing where owner_app_user_id=$1 limit 1", [owner.id]);
    assert(room.rows[0] && invoice.rows[0] && pricing.rows[0], "Expected imported Room, Pricing and Invoice");
    await db.query("update public.app_users set credential_ready=true where id=any($1::uuid[])", [[owner.id, other.id]]);
    await db.query("set local role authenticated");
    for (const [self, foreign] of [[owner, other], [other, owner]]) {
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [self.auth_user_id]);
      for (const table of ["utility_metrics", "utility_pricing", "invoices"]) {
        const visible = await db.query<{ owner_app_user_id: string }>(`select owner_app_user_id from public.${table}`);
        assert(visible.rows.every((row) => row.owner_app_user_id === self.id), `${table} owner isolation failed`);
        const foreignRead = await db.query(`select id from public.${table} where owner_app_user_id=$1`, [foreign.id]);
        assert(foreignRead.rows.length === 0, `${table} cross-owner read permitted`);
      }
    }
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [owner.auth_user_id]);
    await db.query("savepoint historical_price_denied");
    let historicalPriceDenied = false;
    try {
      await db.query("update public.utility_pricing set electricity_unit_price=electricity_unit_price+1 where id=$1", [pricing.rows[0].id]);
    } catch (error) {
      historicalPriceDenied = typeof error === "object" && error !== null && "code" in error && error.code === "42501";
    }
    await db.query("rollback to savepoint historical_price_denied");
    assert(historicalPriceDenied, "Landlord can rewrite historical unit prices directly");
    await db.query("select set_config('request.jwt.claim.sub','',true)");
    for (const table of ["utility_metrics", "utility_pricing", "invoices"]) {
      const anonymous = await db.query(`select id from public.${table}`);
      assert(!anonymous.rows.length, `${table} anonymous read permitted`);
    }
    await db.query("set local role postgres");
    await db.query("update public.app_users set role='staff',owner_app_user_id=$1 where id=$2", [owner.id, other.id]);
    await db.query("set local role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [other.auth_user_id]);
    const staffRead = await db.query("select id from public.invoices where id=$1", [invoice.rows[0].id]);
    assert(staffRead.rows.length === 1, "Staff cannot read own owner's Invoice");
    const staffMetric = await db.query(
      "insert into public.utility_metrics(room_id,month,year,electricity_old,electricity_new,water_old,water_new,owner_app_user_id) values($1,12,2099,0,1,0,1,$2) returning id",
      [room.rows[0].id, owner.id],
    );
    const staffInvoice = await db.query(
      "insert into public.invoices(room_id,month,year,owner_app_user_id) values($1,12,2099,$2) returning id",
      [room.rows[0].id, owner.id],
    );
    assert(staffMetric.rows.length === 1 && staffInvoice.rows.length === 1, "Staff create-only billing policy failed");
    const metricUpdate = await db.query("update public.utility_metrics set electricity_new=electricity_new+1 where id=$1", [staffMetric.rows[0].id]);
    const invoiceUpdate = await db.query("update public.invoices set other_fee=1 where id=$1", [invoice.rows[0].id]);
    assert(!metricUpdate.rowCount && !invoiceUpdate.rowCount, "Staff changed existing billing data");
    await db.query("savepoint pricing_denied");
    let pricingDenied = false;
    try {
      await db.query("insert into public.utility_pricing(effective_from,electricity_unit_price,water_unit_price,owner_app_user_id) values('2099-12-01',1,1,$1)", [owner.id]);
    } catch (error) {
      pricingDenied = typeof error === "object" && error !== null && "code" in error && error.code === "42501";
    }
    await db.query("rollback to savepoint pricing_denied");
    assert(pricingDenied, "Staff created Utility Pricing");
    console.log(JSON.stringify({ projectRef, ownerIsolation: "pass", staffCreateOnly: "pass", historicalPricingImmutable: "pass", mode: "transaction-rolled-back" }));
  } finally { await db.query("rollback"); }
}

void main().catch((error) => {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "ASSERTION";
  console.error(JSON.stringify({ code, message: code === "ASSERTION" && error instanceof Error ? error.message : "Database check failed" }));
  process.exitCode = 1;
}).finally(() => db.end().catch(() => undefined));
