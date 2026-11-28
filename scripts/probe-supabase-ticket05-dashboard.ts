/** Ticket 05 live Dashboard probe. Uses only an explicitly named isolated target. */
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const origin = process.env.TICKET05_API_ORIGIN;
if (!url || !secret) throw new Error("Supabase probe configuration missing");
const projectRef = new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/)?.[1];
if (!projectRef || process.argv[2] !== "--apply" || process.argv[3] !== projectRef)
  throw new Error("Pass --apply and the exact isolated project ref");
if (!origin || !/^http:\/\/localhost:\d+$/.test(origin))
  throw new Error("Set TICKET05_API_ORIGIN to a localhost server with APP_BACKEND=supabase");

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
type Actor = { id: string; cookie: string };
type ApiResult = { status: number; body: { ok?: boolean; data?: Record<string, unknown>; meta?: { timing?: { spans?: Array<{ name: string; durationMs: number }> } } } };
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }

async function main() {
  const suffix = randomUUID();
  const authIds: string[] = [], profileIds: string[] = [];
  const roomIds: string[] = [], tenantIds: string[] = [], contractIds: string[] = [];
  const metricIds: string[] = [], invoiceIds: string[] = [];
  let error: unknown;
  let cleanupFailed = false;
  let result: Record<string, unknown> | undefined;

  async function actor(label: string, role: "landlord" | "staff", ownerId?: string, disabled = false): Promise<Actor> {
    const email = `ticket05-${label}-${suffix}@example.test`;
    const password = randomBytes(32).toString("base64url");
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert(!created.error && created.data.user, "Probe Auth user creation failed");
    authIds.push(created.data.user.id);
    const id = randomUUID();
    const profile = await admin.from("app_users").insert({ id, auth_user_id: created.data.user.id,
      email, display_name: `Ticket 05 ${label}`, role, status: disabled ? "disabled" : "active",
      credential_ready: true, owner_app_user_id: ownerId ?? id });
    assert(!profile.error, "Probe application-user creation failed");
    profileIds.push(id);
    const signedIn = await fetch(`${origin}/api/auth/sign-in`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (disabled) {
      assert(!signedIn.ok, "Disabled user signed in");
      return { id, cookie: "" };
    }
    const payload = await signedIn.json() as { ok?: boolean };
    assert(signedIn.ok && payload.ok, "Probe sign-in failed");
    const cookie = signedIn.headers.getSetCookie().map((part) => part.split(";")[0]).join("; ");
    assert(cookie, "Probe sign-in returned no session cookie");
    return { id, cookie };
  }

  async function insert(table: "rooms" | "tenants" | "contracts" | "utility_metrics" | "invoices", values: Record<string, unknown>) {
    const response = await admin.from(table).insert(values).select("id").single();
    assert(!response.error && response.data, `Probe ${table} insertion failed`);
    const id = response.data.id;
    ({ rooms: roomIds, tenants: tenantIds, contracts: contractIds,
      utility_metrics: metricIds, invoices: invoiceIds })[table].push(id);
    return id;
  }

  async function api(path: string, user: Actor, method = "GET", body?: Record<string, unknown>): Promise<ApiResult> {
    const response = await fetch(`${origin}${path}`, { method,
      headers: { cookie: user.cookie, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), cache: "no-store" });
    return { status: response.status, body: await response.json() as ApiResult["body"] };
  }
  async function warmSample(path: string, user: Actor, method = "GET", body?: Record<string, unknown>) {
    const samples: number[] = [];
    const payloadSizes: number[] = [];
    const layerSpans: Record<string, number[]> = {};
    for (let index = 0; index < 5; index++) {
      const start = performance.now();
      const response = await api(path, user, method, body);
      const elapsedMs = Math.round((performance.now() - start) * 100) / 100;
      assert(response.status === 200 && response.body.ok, `Warm ${method} ${path.split("?")[0]} failed`);
      samples.push(elapsedMs);
      payloadSizes.push(new TextEncoder().encode(JSON.stringify(response.body)).byteLength);
      for (const span of response.body.meta?.timing?.spans ?? [])
        (layerSpans[span.name] ??= []).push(span.durationMs);
    }
    samples.sort((a, b) => a - b);
    payloadSizes.sort((a, b) => a - b);
    return { n: samples.length, p50Ms: samples[2], p95Ms: samples[4], p50PayloadBytes: payloadSizes[2],
      spansP50Ms: Object.fromEntries(Object.entries(layerSpans).map(([name, values]) => [name, [...values].sort((a, b) => a - b)[2]])) };
  }
  const period = (month: number, range?: string) => `month=${month}&year=2026${range ? `&range=${range}` : ""}`;
  const view = (response: ApiResult, name: string) => {
    assert(response.status === 200 && response.body.ok && response.body.data, `${name} API failed`);
    assert(response.body.meta?.timing?.spans?.some((span) => span.name.startsWith("repository.supabase.")), `${name} missing provider timing`);
    return response.body.data;
  };
  async function cleanup(table: string, ids: string[]) {
    for (const id of ids.reverse()) {
      const response = await admin.from(table).delete().eq("id", id);
      if (response.error) cleanupFailed = true;
    }
  }

  try {
    const first = await actor("first", "landlord");
    const second = await actor("second", "landlord");
    const empty = await actor("empty", "landlord");
    const staff = await actor("staff", "staff", first.id);
    await actor("disabled", "landlord", undefined, true);

    const a = await insert("rooms", { name: "Ticket 05 occupied", status: "Available", base_price: 2_000_000, owner_app_user_id: first.id });
    await insert("rooms", { name: "Ticket 05 vacant", status: "Available", base_price: 2_000_000, owner_app_user_id: first.id });
    const b = await insert("rooms", { name: "Ticket 05 second owner", status: "Available", base_price: 3_000_000, owner_app_user_id: second.id });
    const ta = await insert("tenants", { room_id: a, full_name: "Ticket 05 Tenant A", status: "Active", owner_app_user_id: first.id });
    const tb = await insert("tenants", { room_id: b, full_name: "Ticket 05 Tenant B", status: "Active", owner_app_user_id: second.id });
    await insert("contracts", { room_id: a, key_tenant_id: ta, start_date: "2026-01-01", status: "Active", owner_app_user_id: first.id });
    await insert("contracts", { room_id: b, key_tenant_id: tb, start_date: "2026-01-01", status: "Active", owner_app_user_id: second.id });
    await insert("utility_metrics", { room_id: b, month: 8, year: 2026, electricity_old: 0,
      electricity_new: 1, water_old: 0, water_new: 1, owner_app_user_id: second.id });
    await insert("invoices", { room_id: a, month: 8, year: 2026, total_amount: 3000,
      amount_paid: 1000, status: "Partially Paid", owner_app_user_id: first.id });
    await insert("invoices", { room_id: a, month: 9, year: 2026, total_amount: 4000,
      amount_paid: 0, status: "Unpaid", owner_app_user_id: first.id });
    await insert("invoices", { room_id: b, month: 8, year: 2026, total_amount: 700,
      amount_paid: 700, status: "Paid", owner_app_user_id: second.id });

    const roomsA = view(await api("/api/rooms", first), "First owner Rooms") as unknown as Array<{ status: string }>;
    assert(roomsA.length === 2 && roomsA.filter((room) => room.status === "occupied").length === 1,
      "First owner Room availability differs");
    const roomsB = view(await api("/api/rooms", second), "Second owner Rooms") as unknown as Array<unknown>;
    assert(roomsB.length === 1, "Second owner Room availability differs");
    const emptyRooms = view(await api("/api/rooms", empty), "Empty owner Rooms") as unknown as Array<unknown>;
    assert(emptyRooms.length === 0, "New Landlord inherited Rooms");

    const summaryA = view(await api(`/api/dashboard/operations-summary?${period(8)}`, first), "First owner summary");
    const revenueA = summaryA.revenue as { billedRevenue: number; collectedRevenue: number; outstandingDebt: number; invoiceCount: number };
    const missingA = summaryA.missingUtilityMetrics as { rooms: Array<{ id: string }> };
    const unpaidA = summaryA.unpaidInvoices as { totalBalanceDue: number; invoices: Array<{ id: string }> };
    assert(revenueA.billedRevenue === 3000 && revenueA.collectedRevenue === 1000 && revenueA.outstandingDebt === 2000
      && revenueA.invoiceCount === 1 && missingA.rooms.length === 1 && missingA.rooms[0].id === a
      && unpaidA.totalBalanceDue === 2000 && unpaidA.invoices.length === 1, "First owner Dashboard figures differ");
    const summaryB = view(await api(`/api/dashboard/operations-summary?${period(8)}`, second), "Second owner summary");
    assert((summaryB.revenue as { billedRevenue: number }).billedRevenue === 700
      && (summaryB.missingUtilityMetrics as { rooms: unknown[] }).rooms.length === 0
      && (summaryB.unpaidInvoices as { invoices: unknown[] }).invoices.length === 0, "Second owner Dashboard figures differ");
    const summaryEmpty = view(await api(`/api/dashboard/operations-summary?${period(8)}`, empty), "Empty owner summary");
    assert((summaryEmpty.revenue as { invoiceCount: number }).invoiceCount === 0
      && (summaryEmpty.missingUtilityMetrics as { rooms: unknown[] }).rooms.length === 0, "Empty Landlord inherited Dashboard data");
    const summaryStaff = view(await api(`/api/dashboard/operations-summary?${period(8)}`, staff), "Owned Staff summary");
    assert((summaryStaff.revenue as { billedRevenue: number }).billedRevenue === 3000, "Staff Dashboard owner mapping differs");

    const revenueSeptember = view(await api(`/api/dashboard/revenue?${period(9, "this-year")}`, first), "Current-year revenue");
    assert((revenueSeptember as { billedRevenue: number; chartInvoiceCount: number }).billedRevenue === 4000
      && (revenueSeptember as { chartInvoiceCount: number }).chartInvoiceCount === 2, "Multi-period revenue differs");
    const allRevenue = view(await api(`/api/dashboard/revenue?${period(9, "all")}`, second), "All-period revenue");
    assert((allRevenue as { chartInvoiceCount: number }).chartInvoiceCount === 1, "Cross-owner revenue leaked");
    const missing = view(await api(`/api/dashboard/missing-utility-metrics?${period(8)}`, first), "Missing metrics");
    assert((missing as { rooms: unknown[] }).rooms.length === 1, "Missing metrics API differs");
    const unpaid = view(await api(`/api/dashboard/unpaid-invoices?${period(8)}`, first), "Unpaid Invoices");
    assert((unpaid as { totalBalanceDue: number }).totalBalanceDue === 2000, "Unpaid Invoice API differs");
    const anonymous = await fetch(`${origin}/api/dashboard/revenue?${period(8)}`);
    assert(anonymous.status === 401, "Anonymous Dashboard read was allowed");
    const performance = {
      roomsList: await warmSample("/api/rooms", first),
      roomDetail: await warmSample(`/api/rooms/${a}/detail`, first),
      dashboardSummary: await warmSample(`/api/dashboard/operations-summary?${period(8)}`, first),
      dashboardRevenue: await warmSample(`/api/dashboard/revenue?${period(9, "this-year")}`, first),
      invoicesList: await warmSample("/api/invoices", first),
      invoicePayment: await warmSample(`/api/invoices/${invoiceIds[0]}/payment`, first,
        "PATCH", { status: "Partially Paid", amountPaid: 1000 }),
    };
    result = { projectRef, dashboard: "pass", twoOwners: "pass", emptyLandlord: "pass",
      staff: "pass", disabled: "pass", periods: ["2026-08", "2026-09"], partialPayment: "pass", timing: "pass", performance };
  } catch (caught) { error = caught; }
  finally {
    await cleanup("invoices", invoiceIds);
    await cleanup("utility_metrics", metricIds);
    await cleanup("contracts", contractIds);
    await cleanup("tenants", tenantIds);
    await cleanup("rooms", roomIds);
    await cleanup("app_users", profileIds);
    for (const id of authIds.reverse()) if ((await admin.auth.admin.deleteUser(id)).error) cleanupFailed = true;
  }
  if (cleanupFailed) throw new Error("Ticket 05 probe cleanup failed; inspect isolated target");
  if (error) throw error;
  console.log(JSON.stringify(result));
}

void main().catch((error) => {
  console.error(JSON.stringify({ code: "TICKET05_DASHBOARD_PROBE_FAILED", message: error instanceof Error ? error.message : "Probe failed" }));
  process.exitCode = 1;
});
