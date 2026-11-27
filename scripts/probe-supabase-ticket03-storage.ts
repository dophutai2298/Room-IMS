/** Temporary real-user-token Storage/RLS probe on an isolated Supabase target. */
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishable || !secret) throw new Error("Supabase probe configuration missing");
const projectRef = new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/)?.[1];
if (!projectRef || process.argv[2] !== "--apply" || process.argv[3] !== projectRef)
  throw new Error("Pass --apply followed by exact isolated project ref");
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const userClient = () => createClient(url, publishable, { auth: { persistSession: false, autoRefreshToken: false } });
const bucket = "tenant-cccd-private";
const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lXcAAAAASUVORK5CYII=", "base64");
const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  const suffix = randomUUID();
  const createdAuth: string[] = [];
  const createdAppUsers: string[] = [];
  const uploadedKeys: string[] = [];
  let roomId: string | undefined;
  let tenantId: string | undefined;
  let imageId: string | undefined;
  let contractId: string | undefined;
  let apiTenantId: string | undefined;
  let apiImageId: string | undefined;
  let probeOwnerId: string | undefined;
  let primaryError: unknown;
  let cleanupFailed = false;
  let successReport: Record<string, unknown> | undefined;
  async function cleanup(step: () => Promise<boolean>) {
    try { if (!await step()) cleanupFailed = true; } catch { cleanupFailed = true; }
  }
  async function identity(label: string, role: "landlord" | "staff", ownerId?: string) {
    const email = `ticket03-${label}-${suffix}@example.test`;
    const password = randomBytes(32).toString("base64url");
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert(!created.error && created.data.user, "Probe Auth creation failed");
    createdAuth.push(created.data.user.id);
    const appId = randomUUID();
    const inserted = await admin.from("app_users").insert({ id: appId, auth_user_id: created.data.user.id,
      email, display_name: `Ticket 03 ${label}`, role, status: "active", credential_ready: true,
      owner_app_user_id: ownerId ?? appId });
    assert(!inserted.error, "Probe app_user creation failed");
    createdAppUsers.push(appId);
    const client = userClient();
    const login = await client.auth.signInWithPassword({ email, password });
    assert(!login.error && login.data.session, "Probe user-token login failed");
    return { appId, client, email, password };
  }
  try {
    const landlordA = await identity("landlord-a", "landlord");
    probeOwnerId = landlordA.appId;
    const landlordB = await identity("landlord-b", "landlord");
    const staffA = await identity("staff-a", "staff", landlordA.appId);
    const staffB = await identity("staff-b", "staff", landlordB.appId);
    const room = await landlordA.client.from("rooms").insert({ name: "Ticket 03 Storage Probe", status: "Available",
      base_price: 0, owner_app_user_id: landlordA.appId }).select("id").single();
    assert(!room.error && room.data, "Probe Room creation failed");
    roomId = room.data.id;
    const tenant = await landlordA.client.from("tenants").insert({ room_id: roomId,
      full_name: "Ticket 03 Storage Probe", status: "Active", owner_app_user_id: landlordA.appId,
      cccd_front_url: "https://legacy.example.test/private-front.png" }).select("id").single();
    assert(!tenant.error && tenant.data, "Probe Tenant creation failed");
    tenantId = tenant.data.id;
    imageId = randomUUID();
    const key = `${landlordA.appId}/${tenantId}/${imageId}.png`;
    const uploaded = await landlordA.client.storage.from(bucket).upload(key, bytes, { contentType: "image/png", upsert: false });
    assert(!uploaded.error, "Landlord private upload failed");
    uploadedKeys.push(key);
    const meta = await landlordA.client.from("tenant_cccd_images").insert({ id: imageId, tenant_id: tenantId,
      owner_app_user_id: landlordA.appId, storage_key: key, mime_type: "image/png", file_size: bytes.length,
      sha256: hash(bytes) });
    assert(!meta.error, "CCCD metadata creation failed");
    const contract = await landlordA.client.from("contracts").insert({ room_id: roomId, key_tenant_id: tenantId,
      owner_app_user_id: landlordA.appId, start_date: "2026-01-01", deposit_amount: 0, status: "Active" })
      .select("id").single();
    assert(!contract.error && contract.data, "Probe Contract creation failed");
    contractId = contract.data.id;
    assert(contractId, "Probe Contract ID missing");
    if (process.env.TICKET03_API_ORIGIN) {
      const origin = process.env.TICKET03_API_ORIGIN.replace(/\/$/, "");
      const login = async (actor: typeof landlordA) => {
        const response = await fetch(`${origin}/api/auth/sign-in`, { method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: actor.email, password: actor.password }) });
        const body = await response.json() as { ok?: boolean };
        assert(response.ok && body.ok, "API sign-in failed");
        const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
        assert(cookie, "API sign-in returned no session cookie");
        return cookie;
      };
      const landlordCookie = await login(landlordA);
      const staffCookie = await login(staffA);
      const outsiderCookie = await login(landlordB);
      const requestApi = async (path: string, cookie: string, method = "GET", body?: Record<string, unknown>) => {
        const response = await fetch(`${origin}${path}`, { method,
          headers: { cookie, ...(body ? { "content-type": "application/json" } : {}) },
          ...(body ? { body: JSON.stringify(body) } : {}) });
        return { status: response.status, payload: await response.json() as { ok: boolean; data?: unknown } };
      };
      for (const cookie of [landlordCookie, staffCookie]) {
        const detail = await requestApi(`/api/tenants/${tenantId}`, cookie);
        assert(detail.status === 200 && detail.payload.ok && (detail.payload.data as { id?: string })?.id === tenantId,
          "Authorized Tenant detail API failed");
        const images = (detail.payload.data as { cccdImages?: Array<{ url: string }> }).cccdImages ?? [];
        assert(images.length === 1 && images[0].url === `/api/tenants/${tenantId}/cccd-images/${imageId}` + "/content"
          && !JSON.stringify(detail.payload.data).includes("legacy.example.test"),
          "Tenant detail exposed a legacy public CCCD URL");
        const contracts = await requestApi(`/api/rooms/${roomId}/contracts`, cookie);
        assert(contracts.status === 200 && contracts.payload.ok && JSON.stringify(contracts.payload.data).includes(contractId),
          "Authorized Contract list API failed");
        const content = await fetch(`${origin}/api/tenants/${tenantId}/cccd-images/${imageId}/content`,
          { headers: { cookie } });
        assert(content.status === 200 && hash(Buffer.from(await content.arrayBuffer())) === hash(bytes),
          "Authorized CCCD content API returned mismatched bytes");
      }
      const outsider = await requestApi(`/api/tenants/${tenantId}`, outsiderCookie);
      assert(outsider.status === 404, "Unrelated Landlord reached Tenant detail API");
      const outsiderContent = await fetch(`${origin}/api/tenants/${tenantId}/cccd-images/${imageId}/content`,
        { headers: { cookie: outsiderCookie } });
      assert(outsiderContent.status !== 200, "Unrelated Landlord reached CCCD content API");
      const unrelatedStaffCookie = await login(staffB);
      const unrelatedStaffContent = await fetch(`${origin}/api/tenants/${tenantId}/cccd-images/${imageId}/content`,
        { headers: { cookie: unrelatedStaffCookie } });
      assert(unrelatedStaffContent.status !== 200, "Unrelated Staff reached CCCD content API");
      const anonymousContent = await fetch(`${origin}/api/tenants/${tenantId}/cccd-images/${imageId}/content`);
      assert(anonymousContent.status !== 200, "Anonymous reached CCCD content API");
      const form = new FormData();
      form.append("images", new File([bytes], "ticket03-api-probe.png", { type: "image/png" }));
      const uploadResponse = await fetch(`${origin}/api/tenants/${tenantId}/cccd-images`,
        { method: "POST", headers: { cookie: staffCookie }, body: form });
      const uploadBody = await uploadResponse.json() as { ok: boolean; data?: Array<{ id: string }> };
      apiImageId = uploadBody.data?.[0]?.id;
      assert(uploadResponse.status === 200 && uploadBody.ok && apiImageId, "Staff CCCD upload API failed");
      const apiImage = await admin.from("tenant_cccd_images").select("storage_key").eq("id", apiImageId).single();
      assert(!apiImage.error && apiImage.data, "Uploaded CCCD metadata missing");
      uploadedKeys.push(apiImage.data.storage_key);
      const staffImageDelete = await requestApi(`/api/tenants/${tenantId}/cccd-images/${apiImageId}`, staffCookie, "DELETE");
      assert(staffImageDelete.status === 403, "Staff CCCD delete API was not denied");
      const landlordImageDelete = await requestApi(`/api/tenants/${tenantId}/cccd-images/${apiImageId}`, landlordCookie, "DELETE");
      assert(landlordImageDelete.status === 200 && landlordImageDelete.payload.ok,
        `Landlord CCCD delete API failed: ${landlordImageDelete.status} ${(landlordImageDelete.payload as { error?: { code?: string } }).error?.code ?? "unknown"}`);
      const newTenant = { roomId, name: "Ticket 03 API Probe", phone: "0000000000",
        cccdNumber: `TEST-${suffix}`, status: "Active", dateOfBirth: null, permanentAddress: null };
      const created = await requestApi("/api/tenants", staffCookie, "POST", newTenant);
      assert(created.status === 200 && created.payload.ok, "Staff Tenant create API failed");
      apiTenantId = (created.payload.data as { id?: string })?.id;
      assert(apiTenantId, "Staff Tenant create API returned no ID");
      const denied = await requestApi(`/api/tenants/${apiTenantId}`, staffCookie, "PATCH", { ...newTenant, name: "Denied" });
      assert(denied.status === 403, "Staff Tenant update API was not denied");
      const updated = await requestApi(`/api/tenants/${apiTenantId}`, landlordCookie, "PATCH", { ...newTenant, name: "Updated" });
      assert(updated.status === 200 && updated.payload.ok, "Landlord Tenant update API failed");
      const deleted = await requestApi(`/api/tenants/${apiTenantId}`, landlordCookie, "DELETE");
      assert(deleted.status === 200 && deleted.payload.ok, "Landlord Tenant delete API failed");
      apiTenantId = undefined;
    }
    for (const actor of [landlordA, staffA]) {
      const fetched = await actor.client.storage.from(bucket).download(key);
      assert(!fetched.error && fetched.data && hash(Buffer.from(await fetched.data.arrayBuffer())) === hash(bytes),
        "Authorized user cannot download matching private bytes");
    }
    for (const actor of [landlordB, staffB]) {
      const fetched = await actor.client.storage.from(bucket).download(key);
      assert(!fetched.data, "Unrelated account downloaded private CCCD bytes");
      const rows = await actor.client.from("tenant_cccd_images").select("id").eq("id", imageId);
      assert(!rows.error && rows.data?.length === 0, "Unrelated account read CCCD metadata");
    }
    const anonymous = await userClient().storage.from(bucket).download(key);
    assert(!anonymous.data, "Anonymous downloaded private CCCD bytes");
    const staffDelete = await staffA.client.storage.from(bucket).remove([key]);
    const afterStaffDelete = await landlordA.client.storage.from(bucket).download(key);
    assert(afterStaffDelete.data && hash(Buffer.from(await afterStaffDelete.data.arrayBuffer())) === hash(bytes),
      "Staff deleted a private CCCD file");
    assert(staffDelete.error || !staffDelete.data?.some((item) => item.name === key),
      "Storage reported Staff deletion despite no delete permission");
    const staffUploadKey = `${landlordA.appId}/${tenantId}/${randomUUID()}.png`;
    const staffUpload = await staffA.client.storage.from(bucket).upload(staffUploadKey, bytes, { contentType: "image/png" });
    assert(!staffUpload.error, "Related Staff cannot upload private CCCD file");
    uploadedKeys.push(staffUploadKey);
    const landlordDelete = await landlordA.client.storage.from(bucket).remove([staffUploadKey]);
    const afterLandlordDelete = await landlordA.client.storage.from(bucket).download(staffUploadKey);
    assert(!landlordDelete.error && !afterLandlordDelete.data && afterLandlordDelete.error?.statusCode === "404",
      `Landlord cannot verifiably delete private CCCD file: remove=${landlordDelete.error?.status ?? "ok"}, download=${afterLandlordDelete.error?.status ?? "ok"}`);
    uploadedKeys.pop();
    successReport = { projectRef, directUserTokens: 4, api: process.env.TICKET03_API_ORIGIN ? "pass" : "not-run",
      privateUploadReadDelete: "pass",
      unrelatedAndAnonymousDenied: "pass", staffCreateOnly: "pass",
      missingFileStatus: afterLandlordDelete.error?.status ?? null,
      missingFileCode: (afterLandlordDelete.error as { error?: string; statusCode?: string } | null)?.error ?? null,
      missingFileStatusCode: (afterLandlordDelete.error as { statusCode?: string } | null)?.statusCode ?? null,
      removedPathMatched: landlordDelete.data?.some((item) => item.name === staffUploadKey) ?? false };
  } catch (error) { primaryError = error; }
  finally {
    const prefix = probeOwnerId && tenantId ? `${probeOwnerId}/${tenantId}` : null;
    const keys = new Set(uploadedKeys);
    if (prefix) await cleanup(async () => {
      const listed = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      if (listed.error || !listed.data) return false;
      for (const item of listed.data) keys.add(`${prefix}/${item.name}`);
      return true;
    });
    if (keys.size) await cleanup(async () => {
      const removed = await admin.storage.from(bucket).remove([...keys]);
      return !removed.error;
    });
    if (tenantId) await cleanup(async () => !(await admin.from("tenant_cccd_images").delete().eq("tenant_id", tenantId)).error);
    if (contractId) await cleanup(async () => !(await admin.from("contracts").delete().eq("id", contractId)).error);
    if (apiTenantId) await cleanup(async () => !(await admin.from("tenants").delete().eq("id", apiTenantId)).error);
    if (tenantId) await cleanup(async () => !(await admin.from("tenants").delete().eq("id", tenantId)).error);
    if (roomId) await cleanup(async () => !(await admin.from("rooms").delete().eq("id", roomId)).error);
    for (const id of createdAppUsers.reverse()) await cleanup(async () => !(await admin.from("app_users").delete().eq("id", id)).error);
    for (const id of createdAuth.reverse()) await cleanup(async () => !(await admin.auth.admin.deleteUser(id)).error);
    for (const [table, id] of [["rooms", roomId], ["tenants", tenantId], ["tenants", apiTenantId],
      ["contracts", contractId], ["tenant_cccd_images", imageId], ["tenant_cccd_images", apiImageId]] as const) {
      if (id) await cleanup(async () => {
        const result = await admin.from(table).select("id").eq("id", id);
        return !result.error && result.data?.length === 0;
      });
    }
    if (createdAppUsers.length) await cleanup(async () => {
      const result = await admin.from("app_users").select("id").in("id", createdAppUsers);
      return !result.error && result.data?.length === 0;
    });
    if (prefix) await cleanup(async () => {
      const listed = await admin.storage.from(bucket).list(prefix, { limit: 1000 });
      return !listed.error && listed.data?.length === 0;
    });
    for (const key of keys) await cleanup(async () => {
      const result = await admin.storage.from(bucket).download(key);
      return !result.data && result.error?.statusCode === "404";
    });
    for (const id of createdAuth) await cleanup(async () => {
      const result = await admin.auth.admin.getUserById(id);
      return !result.data.user && result.error?.status === 404;
    });
  }
  if (cleanupFailed) throw new Error("Probe cleanup failed; inspect isolated project for ticket03 test records");
  if (primaryError) throw primaryError;
  console.log(JSON.stringify(successReport));
}

void main().catch((error) => {
  console.error(JSON.stringify({ code: "TICKET03_STORAGE_PROBE_FAILED",
    message: error instanceof Error ? error.message : "Storage probe failed" }));
  process.exitCode = 1;
});
