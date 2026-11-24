/** Read-only encrypted InsForge rescue. Commands: --rescue [archive.enc], --verify archive.enc. */
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import { createAdminClient } from "@insforge/sdk";

const TABLES = ["app_users", "rooms", "tenants", "tenant_cccd_images", "contracts", "utility_metrics", "utility_pricing", "invoices"] as const;
type Table = (typeof TABLES)[number];
type Row = Record<string, unknown>;
type Rows = Record<Table, Row[]>;
type AuthUser = { id: string; email: string; emailVerified: boolean; [key: string]: unknown };
type Bucket = { name: string; public?: boolean; [key: string]: unknown };
type StorageObject = { bucket: string; key: string; size: number; mimeType?: string; [key: string]: unknown };
type SavedObject = { bucket: string; key: string; size: number; mimeType: string | null; sha256: string; base64: string };
type LegacyAsset = { tenantId: string; field: "cccd_front_url" | "cccd_back_url"; url: string; mimeType: string | null; size: number; sha256: string; base64: string };
type TableManifest = { count: number; ownerCounts: Record<string, number>; ids: string[]; sha256: string };
type Manifest = {
  createdAt: string;
  sourceHost: string;
  tables: Record<Table, TableManifest>;
  auth: { count: number; ids: string[]; matchedAppUsers: number; hashExport: "unavailable-via-admin-list" };
  buckets: Array<{ name: string; public: boolean; count: number }>;
  objects: Array<Omit<SavedObject, "base64"> & { tenantId: string | null; ownerAppUserId: string | null }>;
  legacyAssets: Array<Omit<LegacyAsset, "base64"> & { ownerAppUserId: string | null }>;
  invoiceTotals: Record<string, { total: string; paid: string; outstanding: string }>;
  issues: string[];
  limitations: string[];
};
type Archive = { version: 1; schemaSql: string; dataSql: string; migrations: unknown[]; rows: Rows; authUsers: AuthUser[]; buckets: Bucket[]; objects: SavedObject[]; legacyAssets: LegacyAsset[]; manifest: Manifest };

const PAGE_SIZE = 200;
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
function error(message: string): never { throw new Error(message); }

function passphrase(): string {
  const value = process.env.RESCUE_BACKUP_PASSPHRASE;
  if (!value || value.length < 20) error("Set RESCUE_BACKUP_PASSPHRASE to at least 20 characters in the private environment");
  return value;
}

function source() {
  const raw = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;
  if (!raw || !apiKey) error("InsForge URL and server API key are required");
  const url = new URL(raw);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && ["127.0.0.1", "localhost"].includes(url.hostname))) error("InsForge URL must use HTTPS");
  return { url, apiKey };
}

async function json<T>(route: string, init: RequestInit = {}): Promise<{ data: T; range: string | null }> {
  const { url: base, apiKey } = source();
  const url = new URL(route, base);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { ...init, headers: { Authorization: `Bearer ${apiKey}`, ...init.headers }, signal: AbortSignal.timeout(30_000) });
      if (!response.ok && response.status !== 206) {
        if ([429, 500, 502, 503, 504].includes(response.status) && attempt < 2) { await pause(500 * (attempt + 1)); continue; }
        error(`InsForge ${url.pathname} returned HTTP ${response.status}`);
      }
      return { data: await response.json() as T, range: response.headers.get("content-range") };
    } catch (cause) {
      if (attempt === 2 || (cause instanceof Error && cause.message.startsWith("InsForge "))) error(`Could not read InsForge ${url.pathname}: ${cause instanceof Error ? cause.message : "network error"}`);
      await pause(500 * (attempt + 1));
    }
  }
  error(`Could not read InsForge ${url.pathname}`);
}

async function tableRows(table: Table): Promise<Row[]> {
  const rows: Row[] = [];
  let total: number | null = null;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, range } = await json<Row[]>(`/api/database/records/${table}?select=*&order=id.asc&limit=${PAGE_SIZE}&offset=${offset}`, { headers: { Prefer: "count=exact" } });
    const match = range?.match(/^(?:\d+-\d+|\*)\/(\d+)$/);
    if (!Array.isArray(data) || !match) error(`Invalid or uncounted ${table} page`);
    const pageTotal = Number(match[1]);
    if (total !== null && total !== pageTotal) error(`${table} changed during export`);
    total = pageTotal;
    rows.push(...data);
    if (rows.length >= total) break;
    if (data.length === 0 || data.length > PAGE_SIZE) error(`Incomplete ${table} page`);
  }
  if (rows.length !== total || new Set(rows.map((row) => row.id)).size !== rows.length || rows.some((row) => typeof row.id !== "string")) error(`Incomplete or duplicate ${table} rows`);
  return rows;
}

async function allRows(): Promise<Rows> {
  const entries = await Promise.all(TABLES.map(async (table) => [table, await tableRows(table)] as const));
  return Object.fromEntries(entries) as Rows;
}

async function authUsers(): Promise<AuthUser[]> {
  const users: AuthUser[] = [];
  let total: number | null = null;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data } = await json<{ data: AuthUser[]; pagination: { total: number } }>(`/api/auth/users?offset=${offset}&limit=${PAGE_SIZE}`);
    if (!Array.isArray(data.data) || !Number.isSafeInteger(data.pagination?.total)) error("Invalid Auth user page");
    if (total !== null && total !== data.pagination.total) error("Auth users changed during export");
    total = data.pagination.total;
    users.push(...data.data);
    if (users.length >= total) break;
    if (!data.data.length) error("Incomplete Auth pagination");
  }
  if (users.length !== total || new Set(users.map((user) => user.id)).size !== users.length) error("Incomplete or duplicate Auth users");
  return users;
}

async function sqlExport(includeData: boolean): Promise<string> {
  const { data } = await json<{ data: string; truncatedTables?: string[] }>("/api/database/advance/export", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tables: TABLES, format: "sql", includeData, includeFunctions: true, includeSequences: true, includeViews: true }),
  });
  if (!data || typeof data.data !== "string" || !data.data || data.truncatedTables?.length) error("SQL export was empty or truncated");
  return data.data;
}

async function objectList(bucket: string): Promise<StorageObject[]> {
  const objects: StorageObject[] = [];
  let total: number | null = null;
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data } = await json<{ data: StorageObject[]; pagination: { total: number } }>(`/api/storage/buckets/${encodeURIComponent(bucket)}/objects?offset=${offset}&limit=${PAGE_SIZE}`);
    if (!Array.isArray(data.data) || !Number.isSafeInteger(data.pagination?.total)) error(`Invalid object page for ${bucket}`);
    if (total !== null && total !== data.pagination.total) error(`${bucket} changed during export`);
    total = data.pagination.total;
    objects.push(...data.data);
    if (objects.length >= total) break;
    if (!data.data.length) error(`Incomplete object list for ${bucket}`);
  }
  if (objects.length !== total || new Set(objects.map((object) => object.key)).size !== objects.length) error(`Incomplete or duplicate objects for ${bucket}`);
  return objects;
}

async function storage(): Promise<{ buckets: Bucket[]; inventory: Manifest["buckets"]; objects: SavedObject[]; issues: string[] }> {
  const { data: buckets } = await json<Bucket[]>("/api/storage/buckets");
  if (!Array.isArray(buckets) || buckets.some((bucket) => typeof bucket.name !== "string")) error("Invalid bucket list");
  const { url, apiKey } = source();
  const client = createAdminClient({ baseUrl: url.toString(), apiKey });
  const objects: SavedObject[] = [];
  const inventory: Manifest["buckets"] = [];
  const issues: string[] = [];
  for (const bucket of buckets) {
    const listed = await objectList(bucket.name);
    inventory.push({ name: bucket.name, public: bucket.public === true, count: listed.length });
    for (const item of listed) {
      if (typeof item.key !== "string") error(`Invalid storage key in ${bucket.name}`);
      const result = await client.storage.from(bucket.name).download(item.key);
      if (result.error || !result.data) { issues.push(`Could not download ${bucket.name}/${item.key}`); continue; }
      const bytes = Buffer.from(await result.data.arrayBuffer());
      if (bytes.length !== item.size) issues.push(`Size mismatch for ${bucket.name}/${item.key}`);
      objects.push({ bucket: bucket.name, key: item.key, size: bytes.length, mimeType: typeof item.mimeType === "string" ? item.mimeType : null, sha256: hash(bytes), base64: bytes.toString("base64") });
    }
  }
  return { buckets, inventory, objects, issues };
}

async function legacyImages(rows: Rows, objects: SavedObject[]): Promise<{ assets: LegacyAsset[]; issues: string[] }> {
  const assets: LegacyAsset[] = [];
  const issues: string[] = [];
  const existing = new Set(objects.map((item) => `${item.bucket}/${item.key}`));
  const sourceHost = source().url.hostname;
  const allowed = new Set((process.env.RESCUE_EXTRA_ASSET_HOSTS ?? "").split(",").map((host) => host.trim()).filter(Boolean));
  for (const tenant of rows.tenants) for (const field of ["cccd_front_url", "cccd_back_url"] as const) {
    const value = tenant[field];
    if (typeof value !== "string" || !value) continue;
    let url: URL;
    try { url = new URL(value); } catch { issues.push(`Invalid legacy URL on Tenant ${tenant.id}/${field}`); continue; }
    const match = url.pathname.match(/\/api\/storage\/buckets\/([^/]+)\/objects\/(.+)$/);
    if (match && existing.has(`${decodeURIComponent(match[1])}/${decodeURIComponent(match[2])}`)) continue;
    if ((url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname))) || (url.hostname !== sourceHost && !allowed.has(url.hostname))) {
      issues.push(`Legacy URL host unavailable for Tenant ${tenant.id}/${field}`);
      continue;
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error("download failed");
      const bytes = Buffer.from(await response.arrayBuffer());
      assets.push({ tenantId: String(tenant.id), field, url: value, mimeType: response.headers.get("content-type"), size: bytes.length, sha256: hash(bytes), base64: bytes.toString("base64") });
    } catch { issues.push(`Could not download legacy image for Tenant ${tenant.id}/${field}`); }
  }
  return { assets, issues };
}

function cents(value: unknown): bigint {
  const match = String(value ?? 0).match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) error("Invalid Invoice monetary value");
  const amount = BigInt(match[2]) * BigInt(100) + BigInt((match[3] ?? "").padEnd(2, "0") || "0");
  return match[1] ? -amount : amount;
}
function money(value: bigint): string {
  const positive = value < BigInt(0) ? -value : value;
  return `${value < BigInt(0) ? "-" : ""}${positive / BigInt(100)}.${(positive % BigInt(100)).toString().padStart(2, "0")}`;
}
function totals(rows: Rows): Manifest["invoiceTotals"] {
  const grouped = new Map<string, { total: bigint; paid: bigint }>();
  for (const invoice of rows.invoices) {
    const key = `${invoice.owner_app_user_id}/${invoice.year}-${String(invoice.month).padStart(2, "0")}`;
    const value = grouped.get(key) ?? { total: BigInt(0), paid: BigInt(0) };
    value.total += cents(invoice.total_amount);
    value.paid += cents(invoice.amount_paid);
    grouped.set(key, value);
  }
  return Object.fromEntries([...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, { total: money(value.total), paid: money(value.paid), outstanding: money(value.total - value.paid) }]));
}
function grandTotals(rows: Rows) {
  let total = BigInt(0), paid = BigInt(0);
  for (const invoice of rows.invoices) { total += cents(invoice.total_amount); paid += cents(invoice.amount_paid); }
  return { total: money(total), paid: money(paid), outstanding: money(total - paid) };
}
function issueKinds(issues: string[]) {
  return { unlinkedObjects: issues.filter((issue) => issue.startsWith("Unlinked CCCD")).length, missingObjects: issues.filter((issue) => issue.startsWith("Missing CCCD") || issue.startsWith("Could not download") || issue.startsWith("Could not download legacy")).length, other: issues.filter((issue) => !issue.startsWith("Unlinked CCCD") && !issue.startsWith("Missing CCCD") && !issue.startsWith("Could not download")).length };
}
function objectLinkage(archive: Archive) {
  const imageKeys = new Set(archive.rows.tenant_cccd_images.map((row) => String(row.storage_key)));
  const tenantIds = new Set(archive.rows.tenants.map((row) => String(row.id)));
  const cccd = archive.objects.filter((object) => object.bucket === "tenant-cccd-images");
  return { linkedByMetadata: cccd.filter((object) => imageKeys.has(object.key)).length, unlinkedWithTenantPrefix: cccd.filter((object) => !imageKeys.has(object.key) && tenantIds.has(object.key.split("/")[0])).length, unlinkedWithoutTenantPrefix: cccd.filter((object) => !imageKeys.has(object.key) && !tenantIds.has(object.key.split("/")[0])).length };
}
function schemaInventory(archive: Archive) {
  const count = (pattern: RegExp) => [...archive.schemaSql.matchAll(pattern)].length;
  return { createTables: count(/\bCREATE\s+TABLE\b/gi), createIndexes: count(/\bCREATE\s+(?:UNIQUE\s+)?INDEX\b/gi), createPolicies: count(/\bCREATE\s+POLICY\b/gi), createFunctions: count(/\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\b/gi), migrations: archive.migrations.length, schemaBytes: Buffer.byteLength(archive.schemaSql), dataSqlBytes: Buffer.byteLength(archive.dataSql) };
}

function relationshipIssues(rows: Rows, users: AuthUser[], objects: SavedObject[]): string[] {
  const keys = Object.fromEntries(TABLES.map((table) => [table, new Set(rows[table].map((row) => row.id))])) as Record<Table, Set<unknown>>;
  const byId = Object.fromEntries(TABLES.map((table) => [table, new Map(rows[table].map((row) => [row.id, row]))])) as Record<Table, Map<unknown, Row>>;
  const authIds = new Set(users.map((user) => user.id));
  const imageKeys = new Set(objects.map((object) => `${object.bucket}/${object.key}`));
  const issues: string[] = [];
  const check = (row: Row, field: string, table: Table) => {
    if (row[field] !== null && row[field] !== undefined && !keys[table].has(row[field])) issues.push(`Missing ${table} reference for ${field} on ${row.id}`);
    const parent = byId[table].get(row[field]);
    if (parent && row.owner_app_user_id && parent.owner_app_user_id && row.owner_app_user_id !== parent.owner_app_user_id) issues.push(`Cross-owner ${table} reference for ${field} on ${row.id}`);
  };
  for (const row of rows.app_users) {
    if (typeof row.auth_user_id !== "string" || !authIds.has(row.auth_user_id)) issues.push(`Missing Auth user for app user ${row.id}`);
    check(row, "owner_app_user_id", "app_users");
    const landlord = byId.app_users.get(row.owner_app_user_id);
    if (row.role === "staff" && landlord && landlord.role !== "landlord") issues.push(`Staff owner is not a Landlord for app user ${row.id}`);
  }
  for (const table of TABLES.filter((name) => name !== "app_users")) for (const row of rows[table]) {
    if (row.owner_app_user_id === null || row.owner_app_user_id === undefined) issues.push(`Unowned ${table} row ${row.id}`);
    check(row, "owner_app_user_id", "app_users");
    if ("room_id" in row) check(row, "room_id", "rooms");
    if (table === "tenant_cccd_images") {
      check(row, "tenant_id", "tenants");
      if (!imageKeys.has(`tenant-cccd-images/${row.storage_key}`)) issues.push(`Missing CCCD object for image ${row.id}`);
    }
    if (table === "contracts") {
      check(row, "key_tenant_id", "tenants");
      const tenant = byId.tenants.get(row.key_tenant_id);
      if (tenant && tenant.room_id !== row.room_id) issues.push(`Contract key Tenant belongs to another Room on ${row.id}`);
    }
  }
  const referencedImages = new Set(rows.tenant_cccd_images.map((row) => `tenant-cccd-images/${row.storage_key}`));
  for (const object of objects) if (object.bucket === "tenant-cccd-images" && !referencedImages.has(`${object.bucket}/${object.key}`)) {
    issues.push(`Unlinked CCCD storage object ${object.bucket}/${object.key}`);
  }
  return issues;
}

function manifestFor(input: Omit<Archive, "manifest">, inventory: Manifest["buckets"], extraIssues: string[]): Manifest {
  const imageByKey = new Map(input.rows.tenant_cccd_images.map((row) => [String(row.storage_key), row]));
  const tenantById = new Map(input.rows.tenants.map((row) => [String(row.id), row]));
  const tables = Object.fromEntries(TABLES.map((table) => {
    const ownerCounts: Record<string, number> = {};
    for (const row of input.rows[table]) {
      const owner = String(row.owner_app_user_id ?? "unowned");
      ownerCounts[owner] = (ownerCounts[owner] ?? 0) + 1;
    }
    return [table, { count: input.rows[table].length, ownerCounts, ids: input.rows[table].map((row) => String(row.id)).sort(), sha256: hash(JSON.stringify(input.rows[table])) }];
  })) as Manifest["tables"];
  const appAuthIds = new Set(input.rows.app_users.map((row) => row.auth_user_id));
  return {
    createdAt: new Date().toISOString(), sourceHost: source().url.host, tables,
    auth: { count: input.authUsers.length, ids: input.authUsers.map((user) => user.id).sort(), matchedAppUsers: input.authUsers.filter((user) => appAuthIds.has(user.id)).length, hashExport: "unavailable-via-admin-list" },
    buckets: inventory,
    objects: input.objects.map((item) => {
      const image = item.bucket === "tenant-cccd-images" ? imageByKey.get(item.key) : undefined;
      return { bucket: item.bucket, key: item.key, size: item.size, mimeType: item.mimeType, sha256: item.sha256, tenantId: image ? String(image.tenant_id) : null, ownerAppUserId: image ? String(image.owner_app_user_id) : null };
    }).sort((a, b) => `${a.bucket}/${a.key}`.localeCompare(`${b.bucket}/${b.key}`)),
    legacyAssets: input.legacyAssets.map((item) => ({ tenantId: item.tenantId, field: item.field, url: item.url, mimeType: item.mimeType, size: item.size, sha256: item.sha256, ownerAppUserId: tenantById.get(item.tenantId) ? String(tenantById.get(item.tenantId)?.owner_app_user_id) : null })).sort((a, b) => `${a.tenantId}/${a.field}`.localeCompare(`${b.tenantId}/${b.field}`)),
    invoiceTotals: totals(input.rows),
    issues: [...extraIssues, ...relationshipIssues(input.rows, input.authUsers, input.objects)],
    limitations: [
      "Auth list omits password hashes, disabled state, project-admin users and anonymous users; password transfer is unverified.",
      "InsForge admin SQL export omits primary keys and orders policies/triggers before dependent functions; isolated restore requires the documented bootstrap and derived SQL.",
      "Admin REST export is not an atomic snapshot while source writes continue; repeat after a write freeze at cutover.",
      "Full database catalog, PostgreSQL server version and extensions require a direct database connection or supported administration query to confirm.",
    ],
  };
}

function encrypt(archive: Archive): Buffer {
  const salt = randomBytes(16), nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", scryptSync(passphrase(), salt, 32), nonce);
  const payload = gzipSync(Buffer.from(JSON.stringify(archive)));
  const ciphertext = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.concat([Buffer.from("IRB1"), salt, nonce, cipher.getAuthTag(), ciphertext]);
}
function decrypt(buffer: Buffer): Archive {
  if (buffer.length < 49 || buffer.subarray(0, 4).toString() !== "IRB1") error("Unrecognized or incomplete rescue archive");
  try {
    const decipher = createDecipheriv("aes-256-gcm", scryptSync(passphrase(), buffer.subarray(4, 20), 32), buffer.subarray(20, 32));
    decipher.setAuthTag(buffer.subarray(32, 48));
    return JSON.parse(gunzipSync(Buffer.concat([decipher.update(buffer.subarray(48)), decipher.final()])).toString("utf8")) as Archive;
  } catch { error("Could not decrypt or authenticate rescue archive"); }
}

function validate(archive: Archive): boolean {
  if (archive.version !== 1 || !archive.schemaSql || !archive.dataSql) error("Archive lacks SQL schema or data export");
  for (const table of TABLES) {
    const rows = archive.rows[table], expected = archive.manifest.tables[table];
    if (!Array.isArray(rows) || !expected) error(`Archive lacks ${table}`);
    const ids = rows.map((row) => row.id);
    const ownerCounts: Record<string, number> = {};
    for (const row of rows) { const owner = String(row.owner_app_user_id ?? "unowned"); ownerCounts[owner] = (ownerCounts[owner] ?? 0) + 1; }
    if (ids.some((id) => typeof id !== "string") || new Set(ids).size !== ids.length || expected.count !== ids.length || expected.sha256 !== hash(JSON.stringify(rows)) || JSON.stringify(expected.ids) !== JSON.stringify([...ids].sort()) || (expected.ownerCounts && JSON.stringify(expected.ownerCounts) !== JSON.stringify(ownerCounts))) error(`${table} archive mismatch`);
  }
  if (archive.authUsers.length !== archive.manifest.auth.count || JSON.stringify(archive.authUsers.map((user) => user.id).sort()) !== JSON.stringify(archive.manifest.auth.ids)) error("Auth archive mismatch");
  for (const object of archive.objects) {
    const bytes = Buffer.from(object.base64, "base64");
    if (bytes.length !== object.size || hash(bytes) !== object.sha256) error(`Object checksum mismatch for ${object.bucket}/${object.key}`);
  }
  for (const asset of archive.legacyAssets) {
    const bytes = Buffer.from(asset.base64, "base64");
    if (bytes.length !== asset.size || hash(bytes) !== asset.sha256) error(`Legacy asset checksum mismatch for ${asset.tenantId}/${asset.field}`);
  }
  if (JSON.stringify(totals(archive.rows)) !== JSON.stringify(archive.manifest.invoiceTotals)) error("Invoice totals mismatch");
  if (relationshipIssues(archive.rows, archive.authUsers, archive.objects).some((issue) => !archive.manifest.issues.includes(issue))) error("Unreported relationship error");
  return archive.manifest.issues.length === 0;
}

async function rescue(destination: string): Promise<void> {
  passphrase();
  const schemaSql = await sqlExport(false);
  const dataSql = await sqlExport(true);
  const { data: history } = await json<{ migrations: unknown[] }>("/api/database/migrations");
  if (!Array.isArray(history.migrations)) error("Invalid migration history");
  const rows = await allRows();
  const users = await authUsers();
  const files = await storage();
  const legacy = await legacyImages(rows, files.objects);
  const content: Omit<Archive, "manifest"> = { version: 1, schemaSql, dataSql, migrations: history.migrations, rows, authUsers: users, buckets: files.buckets, objects: files.objects, legacyAssets: legacy.assets };
  const archive: Archive = { ...content, manifest: manifestFor(content, files.inventory, [...files.issues, ...legacy.issues]) };
  const complete = validate(archive);
  const output = path.resolve(destination);
  await mkdir(path.dirname(output), { recursive: true, mode: 0o700 });
  await writeFile(output, encrypt(archive), { flag: "wx", mode: 0o600 });
  console.log(JSON.stringify({ result: complete ? "saved-and-verified" : "saved-with-issues", archive: output, tables: Object.fromEntries(TABLES.map((table) => [table, rows[table].length])), authUsers: users.length, objects: files.objects.length, legacyAssets: legacy.assets.length, issueCount: archive.manifest.issues.length, issueKinds: issueKinds(archive.manifest.issues), invoiceTotals: grandTotals(rows) }));
  if (!complete) process.exitCode = 2;
}

async function verify(destination: string): Promise<void> {
  const archive = decrypt(await readFile(path.resolve(destination)));
  const complete = validate(archive);
  console.log(JSON.stringify({ result: complete ? "verified" : "verified-with-issues", createdAt: archive.manifest.createdAt, tables: Object.fromEntries(TABLES.map((table) => [table, archive.manifest.tables[table].count])), authUsers: archive.manifest.auth.count, objects: archive.objects.length, legacyAssets: archive.legacyAssets.length, issueCount: archive.manifest.issues.length, issueKinds: issueKinds(archive.manifest.issues), objectLinkage: objectLinkage(archive), invoiceTotals: grandTotals(archive.rows), schemaInventory: schemaInventory(archive), limitations: archive.manifest.limitations }));
  if (!complete) process.exitCode = 2;
}

function safeRestorePath(root: string, ...parts: string[]): string {
  const result = path.resolve(root, ...parts);
  if (!result.startsWith(`${path.resolve(root)}${path.sep}`)) error("Unsafe object path in archive");
  return result;
}

function restoreCompatibleSql(sql: string): string {
  // InsForge's admin SQL export omits primary keys despite emitting foreign
  // keys that reference them. Reintroduce the known id PK immediately after
  // each table definition for an isolated PostgreSQL restore drill.
  let output = sql;
  for (const table of TABLES) {
    const statement = new RegExp(`^(CREATE TABLE IF NOT EXISTS (?:public\\.)?${table} \\([^\\r\\n]*\\);)$`, "m");
    if (!statement.test(output)) error(`Cannot prepare ${table} for PostgreSQL restore`);
    output = output.replace(statement, `$1\nALTER TABLE public.${table} ADD PRIMARY KEY (id);`);
  }
  const duplicateContractTriggers = /CREATE TRIGGER contracts_key_tenant_same_room BEFORE INSERT ON contracts FOR EACH ROW EXECUTE FUNCTION enforce_contract_key_tenant_same_room\(\);\r?\nCREATE TRIGGER contracts_key_tenant_same_room BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION enforce_contract_key_tenant_same_room\(\);/;
  output = output.replace(duplicateContractTriggers, "CREATE TRIGGER contracts_key_tenant_same_room BEFORE INSERT OR UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION enforce_contract_key_tenant_same_room();");
  return output;
}

async function restoreFiles(archivePath: string, directory: string): Promise<void> {
  if (process.env.RESCUE_ALLOW_PLAINTEXT_RESTORE !== "true") error("Set RESCUE_ALLOW_PLAINTEXT_RESTORE=true only for a protected, disposable restore directory");
  const archive = decrypt(await readFile(path.resolve(archivePath)));
  validate(archive);
  const root = path.resolve(directory);
  await mkdir(path.dirname(root), { recursive: true, mode: 0o700 });
  await mkdir(root, { mode: 0o700 }); // fail closed for existing directories or symlinks
  async function save(parts: string[], bytes: Buffer | string) {
    const target = safeRestorePath(root, ...parts);
    await mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    await writeFile(target, bytes, { flag: "wx", mode: 0o600 });
  }
  await save(["schema.sql"], archive.schemaSql);
  await save(["data.sql"], archive.dataSql);
  await save(["data-restorable.sql"], restoreCompatibleSql(archive.dataSql));
  await save(["manifest.json"], JSON.stringify(archive.manifest, null, 2));
  await save(["auth-users.json"], JSON.stringify(archive.authUsers, null, 2));
  await save(["migrations.json"], JSON.stringify(archive.migrations, null, 2));
  for (const table of TABLES) await save(["rows", `${table}.json`], JSON.stringify(archive.rows[table], null, 2));
  for (const object of archive.objects) await save(["objects", object.bucket, object.key], Buffer.from(object.base64, "base64"));
  for (const asset of archive.legacyAssets) await save(["legacy", asset.tenantId, asset.field], Buffer.from(asset.base64, "base64"));
  console.log(JSON.stringify({ result: "restored-files", destination: root, tables: TABLES.length, objects: archive.objects.length, legacyAssets: archive.legacyAssets.length, issueCount: archive.manifest.issues.length }));
}

const [command, target, restoreDirectory] = process.argv.slice(2);
if (command === "--rescue") await rescue(target ?? path.join(".scratch", "insforge-rescue", `insforge-${new Date().toISOString().replace(/[:.]/g, "-")}.enc`));
else if (command === "--verify" && target) await verify(target);
else if (command === "--extract" && target && restoreDirectory) await restoreFiles(target, restoreDirectory);
else error("Usage: rescue-insforge.ts --rescue [archive.enc] | --verify archive.enc | --extract archive.enc protected-directory");
