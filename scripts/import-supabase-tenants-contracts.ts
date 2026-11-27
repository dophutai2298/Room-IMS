/** Ticket 03 isolated import. Never reads or writes a production InsForge service. */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

type Row = Record<string, unknown> & { id: string; owner_app_user_id: string };
type Tenant = Row & { room_id: string | null; cccd_front_url: string | null; cccd_back_url: string | null };
type Contract = Row & { room_id: string; key_tenant_id: string };
type Image = Row & { tenant_id: string; storage_key: string; public_url: string; file_name: string | null; mime_type: string | null; file_size: number | null };
type ObjectEntry = { bucket: string; key: string; size: number; mimeType: string | null; sha256: string; tenantId: string | null; ownerAppUserId: string | null };
type LegacyEntry = { tenantId: string; field: "cccd_front_url" | "cccd_back_url"; url: string; mimeType: string | null; size: number; sha256: string; ownerAppUserId: string | null };
const bucket = "tenant-cccd-private";
const digest = (bytes: Buffer | string) => createHash("sha256").update(bytes).digest("hex");
function assert(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message); }
const sortedIds = (rows: Array<{ id: string }>) => rows.map(({ id }) => id).sort();
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const uuidFrom = (value: string) => {
  const hex = digest(value).slice(0, 32);
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-5${hex.slice(13,16)}-a${hex.slice(17,20)}-${hex.slice(20)}`;
};

async function json<T>(root: string, file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(root, file), "utf8")) as T;
}

async function main() {
  const [root, mode, confirmation] = process.argv.slice(2);
  assert(root && ["--validate", "--dry-run", "--apply"].includes(mode),
    "Usage: import-supabase-tenants-contracts.ts extracted-directory --validate|--dry-run|--apply [project-ref]");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert(url, "NEXT_PUBLIC_SUPABASE_URL is required");
  const projectRef = new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/)?.[1];
  assert(projectRef && url !== process.env.NEXT_PUBLIC_INSFORGE_URL, "Expected an isolated hosted Supabase target");
  assert(mode !== "--apply" || confirmation === projectRef, "Pass exact target project ref after --apply");

  const [tenants, contracts, images, rooms, users, manifest] = await Promise.all([
    json<Tenant[]>(root, "rows/tenants.json"), json<Contract[]>(root, "rows/contracts.json"),
    json<Image[]>(root, "rows/tenant_cccd_images.json"), json<Row[]>(root, "rows/rooms.json"),
    json<Row[]>(root, "rows/app_users.json"),
    json<{ tables: Record<string, { ids: string[]; count: number; sha256: string }>; objects: ObjectEntry[]; legacyAssets: LegacyEntry[] }>(root, "manifest.json"),
  ]);
  for (const [name, rows] of Object.entries({ tenants, contracts, tenant_cccd_images: images, rooms, app_users: users })) {
    assert(same(sortedIds(rows), [...manifest.tables[name].ids].sort()) && rows.length === manifest.tables[name].count,
      `${name} does not match backup manifest`);
    assert(digest(JSON.stringify(rows)) === manifest.tables[name].sha256, `${name} checksum differs from backup manifest`);
  }
  const ownerIds = new Set(users.filter((u) => u.role === "landlord").map((u) => u.id));
  const roomById = new Map(rooms.map((r) => [r.id, r]));
  const tenantById = new Map(tenants.map((t) => [t.id, t]));
  const imageByKey = new Map(images.map((i) => [i.storage_key, i]));
  for (const tenant of tenants) {
    assert(ownerIds.has(tenant.owner_app_user_id), "Tenant owner missing");
    assert(!tenant.room_id || roomById.get(tenant.room_id)?.owner_app_user_id === tenant.owner_app_user_id,
      "Tenant Room missing or cross-owner");
  }
  for (const contract of contracts) {
    const tenant = tenantById.get(contract.key_tenant_id);
    assert(roomById.get(contract.room_id)?.owner_app_user_id === contract.owner_app_user_id
      && tenant?.room_id === contract.room_id && tenant.owner_app_user_id === contract.owner_app_user_id,
    "Contract Room/Key Tenant missing or cross-owner");
  }
  for (const image of images) {
    assert(tenantById.get(image.tenant_id)?.owner_app_user_id === image.owner_app_user_id,
      "CCCD metadata Tenant missing or cross-owner");
  }
  const linkedObjects = manifest.objects.filter((item) => {
    const image = imageByKey.get(item.key);
    if (!image) return false;
    assert(item.tenantId === image.tenant_id && item.ownerAppUserId === image.owner_app_user_id,
      "CCCD object ownership mismatch");
    return true;
  });
  assert(linkedObjects.length === images.length, "One or more CCCD metadata rows have no backed-up bytes");
  assert(new Set(linkedObjects.map((item) => item.key)).size === images.length,
    "CCCD object keys are duplicated or missing");
  for (const item of linkedObjects) assert(item.key.split("/").every((part) => part && part !== ".." && !part.includes("\\")),
    "Unsafe CCCD object key in manifest");
  for (const asset of manifest.legacyAssets) {
    const tenant = tenantById.get(asset.tenantId);
    assert(tenant?.owner_app_user_id === asset.ownerAppUserId && tenant[asset.field] === asset.url,
      "Legacy CCCD asset missing or cross-owner");
  }
  const sourceLegacyCount = tenants.reduce((n, t) => n + Number(Boolean(t.cccd_front_url)) + Number(Boolean(t.cccd_back_url)), 0);
  assert(sourceLegacyCount === manifest.legacyAssets.length, "One or more legacy CCCD URLs have no backed-up bytes");
  const filePlan = [
    ...linkedObjects.map((entry) => {
      const image = imageByKey.get(entry.key)!;
      return { id: image.id, tenantId: image.tenant_id, ownerId: image.owner_app_user_id,
        localPath: path.join(root, "objects", entry.bucket, ...entry.key.split("/")),
        storageKey: `${image.owner_app_user_id}/${image.tenant_id}/${image.id}`,
        sha256: entry.sha256, size: entry.size, mimeType: image.mime_type || entry.mimeType || "image/jpeg",
        fileName: image.file_name, createdAt: image.created_at, sourceKind: "storage" };
    }),
    ...manifest.legacyAssets.map((asset) => ({
      id: uuidFrom(`${asset.tenantId}/${asset.field}`), tenantId: asset.tenantId,
      ownerId: asset.ownerAppUserId!, localPath: path.join(root, "legacy", asset.tenantId, asset.field),
      storageKey: `${asset.ownerAppUserId}/${asset.tenantId}/${uuidFrom(`${asset.tenantId}/${asset.field}`)}`,
      sha256: asset.sha256, size: asset.size, mimeType: asset.mimeType || "image/jpeg",
      fileName: asset.field === "cccd_front_url" ? "CCCD front" : "CCCD back",
      createdAt: null, sourceKind: asset.field === "cccd_front_url" ? "legacy-front" : "legacy-back",
    })),
  ];
  // Read all bytes before touching the target. A missing or corrupt file aborts the whole run.
  const payloads = await Promise.all(filePlan.map(async (item) => {
    const bytes = await readFile(item.localPath);
    assert(bytes.length === item.size && digest(bytes) === item.sha256, "CCCD file checksum mismatch");
    return bytes;
  }));
  const report = { mode, projectRef, tenants: tenants.length, contracts: contracts.length,
    images: filePlan.length, excludedUnlinkedTestObjects: manifest.objects.length - linkedObjects.length,
    manifestValid: true };
  if (mode === "--validate") { console.log(JSON.stringify(report)); return; }

  const secret = process.env.SUPABASE_SECRET_KEY;
  assert(secret, "SUPABASE_SECRET_KEY is required");
  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  for (const [table, rows] of [["rooms", rooms], ["app_users", users]] as const) {
    const result = await admin.from(table).select("id,owner_app_user_id");
    assert(!result.error && result.data && rows.every((r) => result.data!.some((x) => x.id === r.id && x.owner_app_user_id === r.owner_app_user_id)),
      `Target ${table} prerequisite missing or ownership differs`);
  }
  if (mode === "--dry-run") { console.log(JSON.stringify({ ...report, targetReady: true })); return; }

  // Insert only missing IDs. Conflict means a prior run or independent write; compare important fields first.
  async function insertRows(table: string, rows: Row[], fields: string[]) {
    for (const row of rows) {
      const existing = await admin.from(table).select("*").eq("id", row.id).maybeSingle();
      assert(!existing.error, `${table} lookup failed`);
      if (existing.data) {
        for (const field of fields) assert(String(existing.data[field] ?? "") === String(row[field] ?? ""),
          `${table} existing row conflicts on ${field}`);
      } else {
        const inserted = await admin.from(table).insert(row);
        assert(!inserted.error, `${table} insert failed`);
      }
    }
  }
  await insertRows("tenants", tenants.map((t) => ({ ...t, cccd_front_url: null, cccd_back_url: null })),
    ["room_id", "full_name", "phone", "date_of_birth", "permanent_address", "cccd_number", "status", "is_key_tenant", "owner_app_user_id"]);
  await insertRows("contracts", contracts,
    ["room_id", "key_tenant_id", "deposit_amount", "rent_amount", "electricity_price_override", "water_price_override", "start_date", "end_date", "status", "owner_app_user_id"]);
  for (let i = 0; i < filePlan.length; i++) {
    const item = filePlan[i];
    const storage = admin.storage.from(bucket);
    const existingFile = await storage.download(item.storageKey);
    if (existingFile.data) {
      assert(digest(Buffer.from(await existingFile.data.arrayBuffer())) === item.sha256, "Existing CCCD object checksum differs");
    } else {
      const uploaded = await storage.upload(item.storageKey, payloads[i], { contentType: item.mimeType, upsert: false });
      assert(!uploaded.error, "CCCD upload failed");
    }
    const metadata = {
      id: item.id, tenant_id: item.tenantId, owner_app_user_id: item.ownerId,
      storage_key: item.storageKey, file_name: item.fileName, mime_type: item.mimeType,
      file_size: item.size, sha256: item.sha256, source_kind: item.sourceKind,
      ...(item.createdAt ? { created_at: item.createdAt } : {}),
    };
    await insertRows("tenant_cccd_images", [metadata],
      ["tenant_id", "owner_app_user_id", "storage_key", "sha256", "source_kind"]);
  }
  for (const [table, sourceRows] of [["tenants", tenants], ["contracts", contracts], ["tenant_cccd_images", filePlan]] as const) {
    const target = await admin.from(table).select("id,owner_app_user_id");
    assert(!target.error && target.data, `${table} reconciliation read failed`);
    const expectedIds = table === "tenant_cccd_images" ? filePlan.map((x) => x.id).sort() : sortedIds(sourceRows as Row[]);
    assert(same(target.data.map((x) => x.id).sort(), expectedIds), `${table} ID-set reconciliation failed`);
    const expectedOwner = new Map((table === "tenant_cccd_images" ? filePlan.map((x) => ({ id: x.id, owner_app_user_id: x.ownerId })) : sourceRows as Row[])
      .map((x) => [x.id, x.owner_app_user_id]));
    assert(target.data.every((x) => expectedOwner.get(x.id) === x.owner_app_user_id), `${table} owner reconciliation failed`);
  }
  console.log(JSON.stringify({ ...report, reconciled: true }));
}

void main().catch((error) => {
  // Deliberately avoid logging arbitrary provider error objects or paths containing PII.
  console.error(JSON.stringify({ code: "TICKET_03_IMPORT_FAILED", message: error instanceof Error ? error.message : "Import failed" }));
  process.exitCode = 1;
});
