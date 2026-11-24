import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

const appUserId = "10000000-0000-0000-0000-000000000001";
const authUserId = "20000000-0000-0000-0000-000000000001";
const roomId = "30000000-0000-0000-0000-000000000001";
const tenantId = "40000000-0000-0000-0000-000000000001";
const imageId = "50000000-0000-0000-0000-000000000001";
const imageBytes = Buffer.from("fixture identity image bytes");
const tables: Record<string, Record<string, unknown>[]> = {
  app_users: [{ id: appUserId, auth_user_id: authUserId, email: "person@example.test", role: "landlord", status: "active", owner_app_user_id: appUserId }],
  rooms: [{ id: roomId, owner_app_user_id: appUserId, name: "A1", floor: 1, base_price: 2_000_000 }],
  tenants: [{ id: tenantId, room_id: roomId, owner_app_user_id: appUserId, cccd_front_url: null, cccd_back_url: null }],
  tenant_cccd_images: [{ id: imageId, tenant_id: tenantId, owner_app_user_id: appUserId, storage_key: `${tenantId}/front.jpg`, public_url: "https://example.test/front.jpg" }],
  contracts: [],
  utility_metrics: [],
  utility_pricing: [],
  invoices: [{ id: "60000000-0000-0000-0000-000000000001", room_id: roomId, owner_app_user_id: appUserId, month: 7, year: 2026, total_amount: "2800000.00", amount_paid: "1000000.00" }],
};

const tempDir = await mkdtemp(join(tmpdir(), "insforge-rescue-test-"));
after(async () => rm(tempDir, { recursive: true, force: true }));

function run(args: string[], baseUrl: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ["--disable-warning=MODULE_TYPELESS_PACKAGE_JSON", "--experimental-strip-types", "scripts/rescue-insforge.ts", ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NEXT_PUBLIC_INSFORGE_URL: baseUrl,
        INSFORGE_API_KEY: "fixture-api-key",
        RESCUE_BACKUP_PASSPHRASE: "a-long-test-passphrase-for-encrypted-backup",
        RESCUE_ALLOW_PLAINTEXT_RESTORE: "true",
      },
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

test("a complete encrypted snapshot can be verified without exposing its records", async () => {
  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    response.setHeader("Content-Type", "application/json");
    if (url.pathname === "/api/database/advance/export") {
      response.end(JSON.stringify({ format: "sql", data: [...Object.keys(tables).map((table) => `CREATE TABLE IF NOT EXISTS ${table} (id uuid);`), "CREATE TRIGGER contracts_key_tenant_same_room BEFORE INSERT ON contracts FOR EACH ROW EXECUTE FUNCTION enforce_contract_key_tenant_same_room();", "CREATE TRIGGER contracts_key_tenant_same_room BEFORE UPDATE ON contracts FOR EACH ROW EXECUTE FUNCTION enforce_contract_key_tenant_same_room();"].join("\n"), timestamp: "2026-11-24T00:00:00Z" }));
    } else if (url.pathname === "/api/database/migrations") {
      response.end(JSON.stringify({ migrations: [] }));
    } else if (url.pathname === "/api/auth/users") {
      response.end(JSON.stringify({ data: [{ id: authUserId, email: "person@example.test", emailVerified: true, createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z", providers: ["password"], profile: null, metadata: null }], pagination: { offset: Number(url.searchParams.get("offset") ?? 0), limit: 200, total: 1 } }));
    } else if (url.pathname === "/api/storage/buckets") {
      response.end(JSON.stringify([{ name: "tenant-cccd-images", public: true }]));
    } else if (url.pathname === "/api/storage/buckets/tenant-cccd-images/objects") {
      response.end(JSON.stringify({ data: [{ bucket: "tenant-cccd-images", key: `${tenantId}/front.jpg`, size: imageBytes.length, mimeType: "image/jpeg", uploadedAt: "2026-01-01T00:00:00Z", url: "https://example.test/front.jpg" }], pagination: { offset: Number(url.searchParams.get("offset") ?? 0), limit: 200, total: 1 } }));
    } else if (url.pathname.includes("/download-strategy/objects/")) {
      response.end(JSON.stringify({ method: "direct", url: `http://127.0.0.1:${(server.address() as { port: number }).port}/fixture-image` }));
    } else if (url.pathname === "/fixture-image") {
      response.setHeader("Content-Type", "image/jpeg");
      response.end(imageBytes);
    } else if (url.pathname.startsWith("/api/database/records/")) {
      const table = url.pathname.split("/").at(-1) ?? "";
      const rows = tables[table] ?? [];
      const offset = Number(url.searchParams.get("offset") ?? 0);
      const limit = Number(url.searchParams.get("limit") ?? 200);
      const page = rows.slice(offset, offset + limit);
      response.statusCode = rows.length > page.length ? 206 : 200;
      response.setHeader("Content-Range", rows.length ? `${offset}-${offset + page.length - 1}/${rows.length}` : "*/0");
      response.end(JSON.stringify(page));
    } else {
      response.statusCode = 404;
      response.end("{}");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const baseUrl = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const backupPath = join(tempDir, "backup.enc");
    const exportRun = await run(["--rescue", backupPath], baseUrl);
    assert.equal(exportRun.code, 0, exportRun.stderr);
    assert.doesNotMatch(exportRun.stdout, /person@example\.test|fixture identity image bytes|fixture-api-key/);
    const encrypted = await readFile(backupPath);
    assert.equal(encrypted.subarray(0, 4).toString(), "IRB1");
    assert.equal(encrypted.includes(imageBytes), false);
    const verifyRun = await run(["--verify", backupPath], baseUrl);
    assert.equal(verifyRun.code, 0, verifyRun.stderr);
    assert.match(verifyRun.stdout, /verified/i);
    assert.match(verifyRun.stdout, /1800000\.00/);
    const restoreDir = join(tempDir, "isolated-restore");
    const restoreRun = await run(["--extract", backupPath, restoreDir], baseUrl);
    assert.equal(restoreRun.code, 0, restoreRun.stderr);
    const restorableSql = await readFile(join(restoreDir, "data-restorable.sql"), "utf8");
    assert.match(restorableSql, /CREATE TABLE IF NOT EXISTS app_users \(id uuid\);\nALTER TABLE public\.app_users ADD PRIMARY KEY \(id\);/);
    assert.match(restorableSql, /BEFORE INSERT OR UPDATE ON contracts/);
    assert.equal((restorableSql.match(/CREATE TRIGGER contracts_key_tenant_same_room/g) ?? []).length, 1);
    assert.deepEqual(await readFile(join(restoreDir, "objects", "tenant-cccd-images", tenantId, "front.jpg")), imageBytes);
    const restoredInvoices = JSON.parse(await readFile(join(restoreDir, "rows", "invoices.json"), "utf8"));
    assert.equal(restoredInvoices[0].amount_paid, "1000000.00");
    const restoredManifest = JSON.parse(await readFile(join(restoreDir, "manifest.json"), "utf8"));
    assert.equal(restoredManifest.objects[0].tenantId, tenantId);
    assert.equal(restoredManifest.objects[0].ownerAppUserId, appUserId);
    const existingRestoreDir = join(tempDir, "existing-restore");
    await mkdir(existingRestoreDir);
    const unsafeRestore = await run(["--extract", backupPath, existingRestoreDir], baseUrl);
    assert.notEqual(unsafeRestore.code, 0);
  } finally {
    server.close();
  }
});
