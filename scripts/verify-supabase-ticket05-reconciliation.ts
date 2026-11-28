/** Read-only, fail-closed reconciliation of the protected rescue snapshot and isolated target. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

import { validateSupabaseMigrationTarget } from "../src/lib/supabase/migration-target";

type Row = Record<string, unknown> & { id: string; owner_app_user_id: string };
type ObjectEntry = { key: string; sha256: string; size: number; tenantId: string | null; ownerAppUserId: string | null };
type LegacyEntry = { tenantId: string; field: "cccd_front_url" | "cccd_back_url"; sha256: string; size: number; ownerAppUserId: string | null };
type Manifest = { tables: Record<string, { ids: string[]; count: number; sha256: string }>;
  auth: { ids: string[] }; objects: ObjectEntry[]; legacyAssets: LegacyEntry[] };
const tables = ["app_users", "rooms", "tenants", "tenant_cccd_images", "contracts",
  "utility_metrics", "utility_pricing", "invoices"] as const;
const digest = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const sorted = (values: string[]) => [...values].sort();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function cents(value: unknown): bigint {
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  assert(match, "Invalid decimal amount in financial reconciliation");
  return (match[1] ? BigInt(-1) : BigInt(1)) * (BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0")));
}
function generatedLegacyId(value: string) {
  const hex = digest(value).slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}
function ownerCounts(rows: Row[]) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.owner_app_user_id, (counts.get(row.owner_app_user_id) ?? 0) + 1);
  return [...counts].sort(([a], [b]) => a.localeCompare(b));
}
function financialGroups(rows: Row[]) {
  const groups = new Map<string, [bigint, bigint, bigint]>();
  for (const row of rows) {
    const key = `${row.owner_app_user_id}/${row.room_id}/${row.year}/${row.month}`;
    assert(!groups.has(key), "Duplicate owner/Room/period Invoice");
    const total = cents(row.total_amount), paid = cents(row.amount_paid);
    groups.set(key, [total, paid, total - paid]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([key, amounts]) => [key, amounts.map(String)]);
}

async function main() {
  const root = process.argv[2];
  assert(root, "Pass the protected ticket-01 extracted directory");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const databaseUrl = process.env.SUPABASE_DB_URL;
  const secret = process.env.SUPABASE_SECRET_KEY;
  assert(url && databaseUrl && secret, "Supabase target configuration is required");
  const projectRef = validateSupabaseMigrationTarget(url, databaseUrl);
  const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(path.join(root, file), "utf8")) as T;
  const manifest = await json<Manifest>("manifest.json");
  const source = {} as Record<(typeof tables)[number], Row[]>;
  for (const table of tables) {
    const rows = await json<Row[]>(`rows/${table}.json`);
    const entry = manifest.tables[table];
    assert(entry && entry.count === rows.length && same(sorted(rows.map((row) => row.id)), sorted(entry.ids))
      && digest(JSON.stringify(rows)) === entry.sha256, `${table} source manifest mismatch`);
    source[table] = rows;
  }
  const sourceAuth = await json<Array<{ id: string }>>("auth-users.json");
  assert(same(sorted(sourceAuth.map((item) => item.id)), sorted(manifest.auth.ids)), "Source Auth manifest mismatch");

  const db = new pg.Client({ connectionString: databaseUrl,
    ssl: { ca: await readFile(path.join(process.cwd(), "supabase/certs/prod-ca-2021.crt"), "utf8"), rejectUnauthorized: true },
    connectionTimeoutMillis: 8000, query_timeout: 30000, application_name: "rentalroom201-ticket05-reconciliation" });
  const target = {} as Record<(typeof tables)[number], Row[]>;
  let mappings: Array<{ source_auth_user_id: string; target_auth_user_id: string; app_user_id: string }> = [];
  await db.connect();
  try {
    await db.query("begin read only");
    for (const table of tables) {
      const response = await db.query<Row>(`select * from public.${table}`);
      target[table] = response.rows;
      assert(same(sorted(response.rows.map((row) => row.id)), sorted(source[table].map((row) => row.id))),
        `${table} target ID set differs (missing or extra rows)`);
      assert(same(ownerCounts(response.rows), ownerCounts(source[table])), `${table} owner counts differ`);
    }
    const mappingResult = await db.query<{ source_auth_user_id: string; target_auth_user_id: string; app_user_id: string }>(
      "select source_auth_user_id,target_auth_user_id,app_user_id from public.migration_identity_map");
    mappings = mappingResult.rows;
    await db.query("commit");
  } catch (error) { await db.query("rollback"); throw error; }
  finally { await db.end(); }

  const byId = (table: (typeof tables)[number]) => new Map(target[table].map((row) => [row.id, row]));
  const users = byId("app_users"), rooms = byId("rooms"), tenants = byId("tenants");
  for (const user of target.app_users) {
    assert(users.get(user.owner_app_user_id)?.role === "landlord", "Application-user owner link invalid");
    if (user.role === "landlord") assert(user.id === user.owner_app_user_id, "Landlord self-ownership invalid");
  }
  for (const room of target.rooms) assert(users.has(room.owner_app_user_id), "Room owner link invalid");
  for (const tenant of target.tenants) assert(!tenant.room_id || rooms.get(String(tenant.room_id))?.owner_app_user_id === tenant.owner_app_user_id,
    "Tenant Room/owner link invalid");
  for (const contract of target.contracts) {
    const tenant = tenants.get(String(contract.key_tenant_id));
    assert(rooms.get(String(contract.room_id))?.owner_app_user_id === contract.owner_app_user_id
      && tenant?.owner_app_user_id === contract.owner_app_user_id && tenant.room_id === contract.room_id,
    "Contract Room/Key Tenant/owner link invalid");
  }
  for (const table of ["utility_metrics", "invoices"] as const)
    for (const row of target[table]) assert(rooms.get(String(row.room_id))?.owner_app_user_id === row.owner_app_user_id,
      `${table} Room/owner link invalid`);
  for (const image of target.tenant_cccd_images)
    assert(tenants.get(String(image.tenant_id))?.owner_app_user_id === image.owner_app_user_id,
      "CCCD Tenant/owner link invalid");
  assert(same(financialGroups(target.invoices), financialGroups(source.invoices)),
    "Invoice owner/Room/period billed, paid or outstanding amounts differ");

  assert(same(sorted(mappings.map((item) => item.source_auth_user_id)), sorted(sourceAuth.map((item) => item.id))),
    "Auth identity-map source ID set differs");
  assert(same(sorted(mappings.map((item) => item.app_user_id)), sorted(source.app_users.map((item) => item.id))),
    "Auth identity-map application ID set differs");
  for (const mapping of mappings) assert(users.get(mapping.app_user_id)?.auth_user_id === mapping.target_auth_user_id,
    "Auth identity-map target ID differs");

  const expectedImages = [
    ...source.tenant_cccd_images.map((image) => {
      const object = manifest.objects.find((item) => item.key === image.storage_key);
      assert(object && object.tenantId === image.tenant_id && object.ownerAppUserId === image.owner_app_user_id,
        "Source CCCD object mapping missing");
      return { id: image.id, key: `${image.owner_app_user_id}/${image.tenant_id}/${image.id}`,
        sha256: object.sha256, size: object.size };
    }),
    ...manifest.legacyAssets.map((asset) => {
      const tenant = source.tenants.find((item) => item.id === asset.tenantId);
      assert(tenant && tenant.owner_app_user_id === asset.ownerAppUserId && tenant[asset.field],
        "Source legacy CCCD mapping missing");
      const id = generatedLegacyId(`${asset.tenantId}/${asset.field}`);
      return { id, key: `${asset.ownerAppUserId}/${asset.tenantId}/${id}`,
        sha256: asset.sha256, size: asset.size };
    }),
  ];
  assert(same(sorted(target.tenant_cccd_images.map((image) => image.id)), sorted(expectedImages.map((image) => image.id))),
    "Target CCCD metadata IDs differ from linked source files");
  const storage = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } }).storage.from("tenant-cccd-private");
  const targetImages = byId("tenant_cccd_images");
  for (const image of expectedImages) {
    const row = targetImages.get(image.id);
    assert(row?.storage_key === image.key && row.sha256 === image.sha256 && Number(row.file_size) === image.size,
      "Target CCCD locator/checksum metadata differs");
    const downloaded = await storage.download(image.key);
    assert(!downloaded.error && downloaded.data, "Target CCCD bytes unavailable");
    const bytes = new Uint8Array(await downloaded.data.arrayBuffer());
    assert(bytes.length === image.size && digest(bytes) === image.sha256, "Target CCCD bytes differ");
  }

  console.log(JSON.stringify({ projectRef, result: "reconciled", counts: Object.fromEntries(tables.map((table) => [table, target[table].length])),
    ownerCount: target.app_users.filter((user) => user.role === "landlord").length,
    identityMappings: mappings.length, financialGroups: financialGroups(target.invoices).length,
    linkedImageBytes: expectedImages.length, excludedUnlinkedSourceObjects: manifest.objects.length - source.tenant_cccd_images.length }));
}

void main().catch((error) => {
  console.error(JSON.stringify({ code: "TICKET05_RECONCILIATION_FAILED", message: error instanceof Error ? error.message : "Reconciliation failed" }));
  process.exitCode = 1;
});
