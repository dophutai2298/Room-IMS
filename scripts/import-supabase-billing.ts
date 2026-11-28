/** Ticket 04: immutable historical billing import from the ticket 01 snapshot. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type Row = Record<string, unknown> & { id: string; owner_app_user_id: string };
type Manifest = { tables: Record<string, { count: number; ids: string[]; sha256: string }> };
const tables = ["utility_metrics", "utility_pricing", "invoices"] as const;
const fields: Record<(typeof tables)[number], readonly string[]> = {
  utility_metrics: ["id", "room_id", "month", "year", "electricity_old", "electricity_new", "water_old", "water_new", "owner_app_user_id", "created_at", "updated_at"],
  utility_pricing: ["id", "effective_from", "electricity_unit_price", "water_unit_price", "is_active", "owner_app_user_id", "created_at", "updated_at"],
  invoices: ["id", "room_id", "month", "year", "room_fee", "electricity_fee", "water_fee", "other_fee", "other_fee_note", "discount_amount", "discount_note", "total_amount", "amount_paid", "status", "owner_app_user_id", "created_at", "updated_at"],
};
const decimalFields = new Set(["electricity_old", "electricity_new", "water_old", "water_new", "electricity_unit_price", "water_unit_price", "room_fee", "electricity_fee", "water_fee", "other_fee", "discount_amount", "total_amount", "amount_paid"]);
const timestampFields = new Set(["created_at", "updated_at"]);
const digest = (text: string) => createHash("sha256").update(text).digest("hex");
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
const ids = (rows: Row[]) => rows.map((row) => row.id).sort();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function cents(value: unknown): bigint {
  const match = String(value).match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  assert(match, "Invalid decimal amount in billing snapshot or target");
  const whole = BigInt(match[2]);
  const fraction = BigInt((match[3] ?? "").padEnd(2, "0"));
  return (match[1] ? BigInt(-1) : BigInt(1)) * (whole * BigInt(100) + fraction);
}

function equivalent(field: string, source: unknown, target: unknown): boolean {
  if (source === null || target === null) return source === target;
  if (decimalFields.has(field)) return cents(source) === cents(target);
  if (timestampFields.has(field)) return Date.parse(String(source)) === Date.parse(String(target));
  return source === target;
}

async function load<T>(root: string, name: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, name), "utf8")) as T;
}

async function main() {
  const [root, mode, confirmation] = process.argv.slice(2);
  assert(root && ["--validate", "--dry-run", "--apply"].includes(mode),
    "Usage: import-supabase-billing.ts extracted-directory --validate|--dry-run|--apply [project-ref]");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert(url, "NEXT_PUBLIC_SUPABASE_URL is required");
  const projectRef = new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/)?.[1];
  assert(projectRef && url !== process.env.NEXT_PUBLIC_INSFORGE_URL, "Expected isolated Supabase target");
  assert(mode !== "--apply" || confirmation === projectRef, "Pass exact target project ref after --apply");
  const manifest = await load<Manifest>(root, "manifest.json");
  const [rooms, users, contracts] = await Promise.all([
    load<Row[]>(root, "rows/rooms.json"), load<Row[]>(root, "rows/app_users.json"), load<Row[]>(root, "rows/contracts.json"),
  ]);
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const owners = new Set(users.filter((u) => u.role === "landlord").map((u) => u.id));
  const contractRooms = new Set(contracts.map((c) => c.room_id));
  const source = {} as Record<(typeof tables)[number], Row[]>;
  for (const table of tables) {
    const rows = await load<Row[]>(root, `rows/${table}.json`);
    const entry = manifest.tables[table];
    assert(entry && entry.count === rows.length && same(ids(rows), [...entry.ids].sort())
      && entry.sha256 === digest(JSON.stringify(rows)), `${table} snapshot manifest mismatch`);
    for (const row of rows) {
      assert(owners.has(row.owner_app_user_id), `${table} owner not in snapshot`);
      if (table !== "utility_pricing") {
        assert(roomById.get(String(row.room_id))?.owner_app_user_id === row.owner_app_user_id, `${table} Room owner mismatch`);
        assert(Number.isInteger(row.month) && Number.isInteger(row.year), `${table} invalid period`);
      }
      if (table === "invoices") {
        assert(contractRooms.has(row.room_id), "Invoice Room has no source Contract");
        const total = cents(row.total_amount), paid = cents(row.amount_paid);
        assert(paid >= BigInt(0) && paid <= total && (
          (row.status === "Unpaid" && paid === BigInt(0)) ||
          (row.status === "Paid" && paid === total) ||
          (row.status === "Partially Paid" && paid > BigInt(0) && paid < total)
        ), "Invoice payment state inconsistent in snapshot");
      }
    }
    source[table] = rows;
  }
  const report = { projectRef, mode, counts: Object.fromEntries(tables.map((t) => [t, source[t].length])), snapshotValid: true };
  if (mode === "--validate") { console.log(JSON.stringify(report)); return; }
  const key = process.env.SUPABASE_SECRET_KEY;
  assert(key, "SUPABASE_SECRET_KEY is required");
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  async function readAll(table: string, columns = "*"): Promise<Row[]> {
    const pageSize = 500;
    const rows: Row[] = [];
    for (let offset = 0; ; offset += pageSize) {
      const page = await admin.from(table).select(columns).order("id").range(offset, offset + pageSize - 1);
      assert(!page.error && page.data, `${table} paged read failed`);
      rows.push(...page.data as unknown as Row[]);
      if (page.data.length < pageSize) return rows;
    }
  }
  const [targetRooms, targetContracts] = await Promise.all([
    readAll("rooms", "id,owner_app_user_id"), readAll("contracts", "id,room_id,owner_app_user_id"),
  ]);
  assert(rooms.every((room) => targetRooms.some((r) => r.id === room.id && r.owner_app_user_id === room.owner_app_user_id)), "Target Room ID/owner mismatch");
  assert(contracts.every((contract) => targetContracts.some((r) => r.id === contract.id && r.room_id === contract.room_id && r.owner_app_user_id === contract.owner_app_user_id)), "Target Contract ID/owner mismatch");
  if (mode === "--dry-run") { console.log(JSON.stringify({ ...report, targetReady: true })); return; }

  for (const table of tables) {
    for (const row of source[table]) {
      const existing = await admin.from(table).select("*").eq("id", row.id).maybeSingle();
      assert(!existing.error, `${table} lookup failed`);
      if (existing.data) {
        for (const field of fields[table]) assert(equivalent(field, row[field], existing.data[field]), `${table} existing row differs on ${field}`);
      } else {
        const inserted = await admin.from(table).insert(row);
        assert(!inserted.error, `${table} historical insert failed (${inserted.error?.code ?? "unknown"}, ${inserted.error?.message?.match(/column "[a-z_]+"|constraint "[a-z_]+"/)?.[0] ?? "no safe detail"})`);
      }
    }
    const target = await readAll(table);
    assert(same(ids(target), ids(source[table])), `${table} target ID set differs from snapshot`);
    const byId = new Map(target.map((row) => [row.id, row]));
    for (const row of source[table]) {
      const actual = byId.get(row.id)!;
      for (const field of fields[table]) assert(equivalent(field, row[field], actual[field]), `${table} reconciliation differs on ${field}`);
    }
  }
  const financial = (rows: Row[]) => rows.reduce((acc, row) => {
    const key = `${row.owner_app_user_id}/${row.room_id}/${row.year}/${row.month}`;
    acc[key] = [cents(row.total_amount), cents(row.amount_paid), cents(row.total_amount) - cents(row.amount_paid)].map(String);
    return acc;
  }, {} as Record<string, string[]>);
  const targetInvoices = await readAll("invoices");
  const sourceFinancial = financial(source.invoices);
  const targetFinancial = financial(targetInvoices);
  assert(same(Object.keys(sourceFinancial).sort(), Object.keys(targetFinancial).sort())
    && Object.keys(sourceFinancial).every((key) => same(sourceFinancial[key], targetFinancial[key])), "Invoice owner/Room/period financial totals differ");
  console.log(JSON.stringify({ ...report, reconciled: true, financialGroups: Object.keys(financial(source.invoices)).length }));
}

void main().catch((error) => {
  console.error(JSON.stringify({ code: "TICKET_04_IMPORT_FAILED", message: error instanceof Error ? error.message : "Import failed" }));
  process.exitCode = 1;
});
