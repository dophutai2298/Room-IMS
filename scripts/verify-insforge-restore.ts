/** Compare a disposable PostgreSQL restore and extracted file bytes with a rescue manifest. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const TABLES = ["app_users", "rooms", "tenants", "tenant_cccd_images", "contracts", "utility_metrics", "utility_pricing", "invoices"] as const;
type Table = (typeof TABLES)[number];
type TableManifest = { count: number; ids: string[]; ownerCounts: Record<string, number> };
type Manifest = {
  tables: Record<Table, TableManifest>;
  objects: { bucket: string; key: string; size: number; sha256: string }[];
  legacyAssets: { tenantId: string; field: string; size: number; sha256: string }[];
  invoiceTotals: Record<string, { total: string; paid: string; outstanding: string }>;
};

const [directory, container, database] = process.argv.slice(2);
if (!directory || !container || !database || !/^[\w-]+$/.test(container) || !/^[\w-]+$/.test(database)) {
  throw new Error("Usage: verify-insforge-restore.ts extracted-directory docker-container database");
}
const root = path.resolve(directory);
const manifest = JSON.parse(await readFile(path.join(root, "manifest.json"), "utf8")) as Manifest;

function fail(label: string): never { throw new Error(`Restore mismatch: ${label}`); }
function query(sql: string): string[] {
  const output = execFileSync("docker", ["exec", container, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-A", "-t", "-F", "|", "-U", "postgres", "-d", database, "-c", sql], {
    encoding: "utf8", maxBuffer: 10 * 1024 * 1024, timeout: 30_000, windowsHide: true,
  });
  return output.trim() ? output.trim().split(/\r?\n/) : [];
}
function cents(value: string): bigint {
  const match = value.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) fail("invalid monetary amount");
  const magnitude = BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0") || "0");
  return match[1] ? -magnitude : magnitude;
}
function inside(...parts: string[]): string {
  const result = path.resolve(root, ...parts);
  if (!result.startsWith(`${root}${path.sep}`)) fail("unsafe file path");
  return result;
}
function sameValue(source: unknown, restored: unknown, column: string): boolean {
  if (source === null || restored === null) return source === restored;
  if (column.endsWith("_at") && typeof source === "string" && typeof restored === "string") {
    return Date.parse(source) === Date.parse(restored);
  }
  if (typeof source === "number" || typeof restored === "number") {
    const decimal = (value: unknown) => {
      const [whole, fractional] = String(value).split(".");
      return fractional === undefined ? whole : `${whole}.${fractional.replace(/0+$/, "")}`.replace(/\.$/, "");
    };
    return decimal(source) === decimal(restored);
  }
  return source === restored;
}

for (const table of TABLES) {
  const expected = manifest.tables[table];
  const ids = query(`SELECT id::text FROM public.${table} ORDER BY id::text`);
  if (ids.length !== expected.count || JSON.stringify(ids) !== JSON.stringify(expected.ids)) fail(`${table} IDs/count`);
  const owners = Object.fromEntries(query(`SELECT COALESCE(owner_app_user_id::text, 'unowned'), COUNT(*) FROM public.${table} GROUP BY 1 ORDER BY 1`).map((line) => {
    const [owner, count] = line.split("|");
    return [owner, Number(count)];
  }));
  if (JSON.stringify(Object.entries(owners).sort()) !== JSON.stringify(Object.entries(expected.ownerCounts).sort())) fail(`${table} owner counts`);
  const sourceRows = JSON.parse(await readFile(inside("rows", `${table}.json`), "utf8")) as Record<string, unknown>[];
  const restoredRows = JSON.parse(query(`SELECT COALESCE(json_agg(row_to_json(t) ORDER BY id::text), '[]'::json)::text FROM public.${table} t`)[0] ?? "[]") as Record<string, unknown>[];
  const sourceById = new Map(sourceRows.map((row) => [row.id, row]));
  if (restoredRows.length !== sourceRows.length) fail(`${table} record count`);
  for (const row of restoredRows) {
    const original = sourceById.get(row.id);
    if (!original || JSON.stringify(Object.keys(original).sort()) !== JSON.stringify(Object.keys(row).sort())) fail(`${table} record fields`);
    for (const column of Object.keys(original)) if (!sameValue(original[column], row[column], column)) fail(`${table} record value`);
  }
}

const periods = query("SELECT COALESCE(owner_app_user_id::text, 'null') || '/' || year || '-' || LPAD(month::text, 2, '0'), SUM(total_amount)::text, SUM(amount_paid)::text, (SUM(total_amount) - SUM(amount_paid))::text FROM public.invoices GROUP BY owner_app_user_id, year, month ORDER BY 1");
if (periods.length !== Object.keys(manifest.invoiceTotals).length) fail("Invoice period count");
for (const line of periods) {
  const [key, total, paid, outstanding] = line.split("|");
  const expected = manifest.invoiceTotals[key];
  if (!expected || cents(total) !== cents(expected.total) || cents(paid) !== cents(expected.paid) || cents(outstanding) !== cents(expected.outstanding)) fail("Invoice period totals");
}

for (const item of manifest.objects) {
  const bytes = await readFile(inside("objects", item.bucket, item.key));
  if (bytes.length !== item.size || createHash("sha256").update(bytes).digest("hex") !== item.sha256) fail("Storage object checksum");
}
for (const item of manifest.legacyAssets) {
  const bytes = await readFile(inside("legacy", item.tenantId, item.field));
  if (bytes.length !== item.size || createHash("sha256").update(bytes).digest("hex") !== item.sha256) fail("Legacy asset checksum");
}
console.log(JSON.stringify({ result: "restored-and-reconciled", tables: TABLES.length, objects: manifest.objects.length, legacyAssets: manifest.legacyAssets.length, invoicePeriods: periods.length }));
