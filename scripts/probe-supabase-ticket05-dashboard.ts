/** Ticket 05 live Dashboard probe. Uses only an explicitly named isolated target. */
import { randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
const origin = process.env.TICKET05_API_ORIGIN;
const snapshotRoot = process.argv[4];
if (!url || !publishable || !secret) throw new Error("Supabase probe configuration missing");
const projectRef = new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/)?.[1];
if (!projectRef || process.argv[2] !== "--apply" || process.argv[3] !== projectRef)
  throw new Error("Pass --apply and the exact isolated project ref");
if (!origin || !/^http:\/\/localhost:\d+$/.test(origin))
  throw new Error("Set TICKET05_API_ORIGIN to a localhost server with APP_BACKEND=supabase");
if (!snapshotRoot) throw new Error("Pass the protected extracted snapshot directory after the project ref");

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
type Actor = { id: string; cookie: string; client: SupabaseClient };
type SourceRow = Record<string, unknown> & { id: string; owner_app_user_id: string };
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
    const client = createClient(url!, publishable!, { auth: { persistSession: false, autoRefreshToken: false } });
    const directSignIn = await client.auth.signInWithPassword({ email, password });
    assert(!directSignIn.error && directSignIn.data.session, "Direct user-token sign-in failed");
    const signedIn = await fetch(`${origin}/api/auth/sign-in`, { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    if (disabled) {
      assert(!signedIn.ok, "Disabled user signed in");
      return { id, cookie: "", client };
    }
    const payload = await signedIn.json() as { ok?: boolean };
    assert(signedIn.ok && payload.ok, "Probe sign-in failed");
    const cookie = signedIn.headers.getSetCookie().map((part) => part.split(";")[0]).join("; ");
    assert(cookie, "Probe sign-in returned no session cookie");
    return { id, cookie, client };
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
    const warmup = await api(path, user, method, body);
    assert(warmup.status === 200 && warmup.body.ok, `Warm-up ${method} ${path.split("?")[0]} failed`);
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
  const sourceJson = async (table: string): Promise<SourceRow[]> =>
    JSON.parse(await readFile(path.join(snapshotRoot, "rows", `${table}.json`), "utf8")) as SourceRow[];
  async function checkImportedDashboard() {
    const [users, rooms, contracts, metrics, invoices] = await Promise.all(
      ["app_users", "rooms", "contracts", "utility_metrics", "invoices"].map(sourceJson));
    const landlords = users.filter((user) => user.role === "landlord");
    assert(landlords.length >= 2, "Imported Dashboard needs two unrelated Landlords");
    let periodsChecked = 0;
    let partialChecked = false;
    for (const [landlordIndex, landlord] of landlords.entries()) {
      const reader = await actor(`imported-reader-${landlordIndex}`, "staff", landlord.id);
      const ownRooms = rooms.filter((row) => row.owner_app_user_id === landlord.id);
      const ownContracts = contracts.filter((row) => row.owner_app_user_id === landlord.id && row.status === "Active");
      const ownMetrics = metrics.filter((row) => row.owner_app_user_id === landlord.id);
      const ownInvoices = invoices.filter((row) => row.owner_app_user_id === landlord.id);
      const roomList = view(await api("/api/rooms", reader), "Imported Room list") as unknown as Array<{ id: string; status: string }>;
      assert(roomList.length === ownRooms.length, "Imported Room count differs from snapshot");
      for (const room of ownRooms) {
        const expectedStatus = room.status === "Maintenance" ? "maintenance"
          : ownContracts.some((contract) => contract.room_id === room.id) ? "occupied" : "available";
        assert(roomList.find((item) => item.id === room.id)?.status === expectedStatus,
          "Imported Room availability differs from snapshot");
      }
      const partial = ownInvoices.find((invoice) => invoice.status === "Partially Paid");
      const sortedPeriods = [...new Set(ownInvoices.map((invoice) => `${invoice.year}-${String(invoice.month).padStart(2, "0")}`))].sort();
      const partialPeriod = partial ? `${partial.year}-${String(partial.month).padStart(2, "0")}` : null;
      const selected = partial
        ? [...new Set([partialPeriod!, [...sortedPeriods].reverse().find((period) => period !== partialPeriod) ?? partialPeriod!])]
        : sortedPeriods.length ? [sortedPeriods.at(-1)!] : ["2026-08"];
      for (const selectedPeriod of selected) {
        const [year, month] = selectedPeriod.split("-").map(Number);
        const periodInvoices = ownInvoices.filter((invoice) => Number(invoice.month) === month && Number(invoice.year) === year);
        const periodMetrics = new Set(ownMetrics.filter((metric) => Number(metric.month) === month && Number(metric.year) === year)
          .map((metric) => metric.room_id));
        const expectedMissing = ownRooms.filter((room) => room.status !== "Maintenance"
          && ownContracts.some((contract) => contract.room_id === room.id) && !periodMetrics.has(room.id))
          .map((room) => room.id).sort();
        const expectedUnpaid = periodInvoices.filter((invoice) => invoice.status !== "Paid").map((invoice) => invoice.id).sort();
        const expectedBilled = periodInvoices.reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
        const expectedCollected = periodInvoices.reduce((sum, invoice) => sum + Number(invoice.amount_paid), 0);
        const expectedBalance = periodInvoices.reduce((sum, invoice) =>
          sum + Math.max(Number(invoice.total_amount) - Number(invoice.amount_paid), 0), 0);
        const dashboard = view(await api(`/api/dashboard/operations-summary?month=${month}&year=${year}`, reader), "Imported Dashboard summary");
        const revenue = dashboard.revenue as { billedRevenue: number; collectedRevenue: number; outstandingDebt: number; invoiceCount: number };
        const missing = dashboard.missingUtilityMetrics as { rooms: Array<{ id: string }> };
        const unpaid = dashboard.unpaidInvoices as { invoices: Array<{ id: string }>; totalBalanceDue: number };
        assert(revenue.billedRevenue === expectedBilled && revenue.collectedRevenue === expectedCollected
          && revenue.outstandingDebt === expectedBalance && revenue.invoiceCount === periodInvoices.length,
          "Imported Dashboard money differs from snapshot");
        assert(JSON.stringify(missing.rooms.map((room) => room.id).sort()) === JSON.stringify(expectedMissing),
          "Imported missing-meter reminders differ from snapshot");
        assert(JSON.stringify(unpaid.invoices.map((invoice) => invoice.id).sort()) === JSON.stringify(expectedUnpaid)
          && unpaid.totalBalanceDue === expectedBalance, "Imported unpaid-Invoice reminders differ from snapshot");
        const all = view(await api(`/api/dashboard/revenue?month=${month}&year=${year}&range=all`, reader), "Imported all-period revenue");
        const expectedTrendCount = ownInvoices.filter((invoice) =>
          Number(invoice.year) < year || (Number(invoice.year) === year && Number(invoice.month) <= month)).length;
        assert((all as { chartInvoiceCount: number }).chartInvoiceCount === expectedTrendCount,
          "Imported revenue history differs from snapshot");
        periodsChecked++;
        if (periodInvoices.some((invoice) => invoice.status === "Partially Paid")) partialChecked = true;
      }
    }
    assert(periodsChecked >= 3 && partialChecked, "Imported Dashboard did not cover multiple periods and a partial payment");
    return { landlords: landlords.length, periodsChecked, partialPayment: partialChecked };
  }
  async function cleanup(table: "invoices" | "utility_metrics" | "contracts" | "tenants" | "rooms" | "app_users", ids: string[]) {
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
    const disabled = await actor("disabled", "landlord", undefined, true);

    const firstOccupiedRoomId = await insert("rooms", { name: "Ticket 05 occupied", status: "Available", base_price: 2_000_000, owner_app_user_id: first.id });
    await insert("rooms", { name: "Ticket 05 vacant", status: "Available", base_price: 2_000_000, owner_app_user_id: first.id });
    const secondOccupiedRoomId = await insert("rooms", { name: "Ticket 05 second Landlord", status: "Available", base_price: 3_000_000, owner_app_user_id: second.id });
    const firstTenantId = await insert("tenants", { room_id: firstOccupiedRoomId, full_name: "Ticket 05 Tenant A", status: "Active", owner_app_user_id: first.id });
    const secondTenantId = await insert("tenants", { room_id: secondOccupiedRoomId, full_name: "Ticket 05 Tenant B", status: "Active", owner_app_user_id: second.id });
    await insert("contracts", { room_id: firstOccupiedRoomId, key_tenant_id: firstTenantId, start_date: "2026-01-01", status: "Active", owner_app_user_id: first.id });
    await insert("contracts", { room_id: secondOccupiedRoomId, key_tenant_id: secondTenantId, start_date: "2026-01-01", status: "Active", owner_app_user_id: second.id });
    await insert("utility_metrics", { room_id: secondOccupiedRoomId, month: 8, year: 2026, electricity_old: 0,
      electricity_new: 1, water_old: 0, water_new: 1, owner_app_user_id: second.id });
    await insert("invoices", { room_id: firstOccupiedRoomId, month: 8, year: 2026, total_amount: 3000,
      amount_paid: 1000, status: "Partially Paid", owner_app_user_id: first.id });
    await insert("invoices", { room_id: firstOccupiedRoomId, month: 9, year: 2026, total_amount: 4000,
      amount_paid: 0, status: "Unpaid", owner_app_user_id: first.id });
    await insert("invoices", { room_id: secondOccupiedRoomId, month: 8, year: 2026, total_amount: 700,
      amount_paid: 700, status: "Paid", owner_app_user_id: second.id });

    const roomsA = view(await api("/api/rooms", first), "First Landlord Rooms") as unknown as Array<{ status: string }>;
    assert(roomsA.length === 2 && roomsA.filter((room) => room.status === "occupied").length === 1,
      "First Landlord Room availability differs");
    const roomsB = view(await api("/api/rooms", second), "Second Landlord Rooms") as unknown as Array<unknown>;
    assert(roomsB.length === 1, "Second Landlord Room availability differs");
    const emptyRooms = view(await api("/api/rooms", empty), "Empty Landlord Rooms") as unknown as Array<unknown>;
    assert(emptyRooms.length === 0, "New Landlord inherited Rooms");

    const summaryA = view(await api(`/api/dashboard/operations-summary?${period(8)}`, first), "First Landlord summary");
    const revenueA = summaryA.revenue as { billedRevenue: number; collectedRevenue: number; outstandingDebt: number; invoiceCount: number };
    const missingA = summaryA.missingUtilityMetrics as { rooms: Array<{ id: string }> };
    const unpaidA = summaryA.unpaidInvoices as { totalBalanceDue: number; invoices: Array<{ id: string }> };
    assert(revenueA.billedRevenue === 3000 && revenueA.collectedRevenue === 1000 && revenueA.outstandingDebt === 2000
      && revenueA.invoiceCount === 1 && missingA.rooms.length === 1 && missingA.rooms[0].id === firstOccupiedRoomId
      && unpaidA.totalBalanceDue === 2000 && unpaidA.invoices.length === 1, "First Landlord Dashboard figures differ");
    const summaryB = view(await api(`/api/dashboard/operations-summary?${period(8)}`, second), "Second Landlord summary");
    assert((summaryB.revenue as { billedRevenue: number }).billedRevenue === 700
      && (summaryB.missingUtilityMetrics as { rooms: unknown[] }).rooms.length === 0
      && (summaryB.unpaidInvoices as { invoices: unknown[] }).invoices.length === 0, "Second Landlord Dashboard figures differ");
    const summaryEmpty = view(await api(`/api/dashboard/operations-summary?${period(8)}`, empty), "Empty Landlord summary");
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
    for (const [actor, expectedRoomCount] of [[first, 2], [second, 1], [staff, 2], [empty, 0], [disabled, 0]] as const) {
      const directRooms = await actor.client.from("rooms").select("id");
      assert(!directRooms.error && directRooms.data.length === expectedRoomCount, "Direct user-token Room RLS differs");
    }
    const crossOwnerRead = await second.client.from("invoices").select("id").eq("id", invoiceIds[0]);
    assert(!crossOwnerRead.error && crossOwnerRead.data.length === 0, "Direct cross-owner Invoice read was allowed");
    const crossOwnerWrite = await second.client.from("invoices").update({ amount_paid: 2, status: "Partially Paid" })
      .eq("id", invoiceIds[0]).select("id");
    assert(crossOwnerWrite.error || crossOwnerWrite.data?.length === 0, "Direct cross-owner Invoice write was allowed");
    const staffWrite = await staff.client.from("invoices").update({ amount_paid: 2, status: "Partially Paid" })
      .eq("id", invoiceIds[0]).select("id");
    assert(staffWrite.error || staffWrite.data?.length === 0, "Direct Staff Invoice update was allowed");
    const stillPartial = await first.client.from("invoices").select("amount_paid,status").eq("id", invoiceIds[0]).single();
    assert(!stillPartial.error && Number(stillPartial.data?.amount_paid) === 1000
      && stillPartial.data?.status === "Partially Paid", "Denied direct write changed Invoice");
    const importedDashboard = await checkImportedDashboard();
    const performance = {
      roomsList: await warmSample("/api/rooms", first),
      roomDetail: await warmSample(`/api/rooms/${firstOccupiedRoomId}/detail`, first),
      dashboardSummary: await warmSample(`/api/dashboard/operations-summary?${period(8)}`, first),
      dashboardRevenue: await warmSample(`/api/dashboard/revenue?${period(9, "this-year")}`, first),
      invoicesList: await warmSample("/api/invoices", first),
      invoicePayment: await warmSample(`/api/invoices/${invoiceIds[0]}/payment`, first,
        "PATCH", { status: "Partially Paid", amountPaid: 1000 }),
    };
    result = { projectRef, dashboard: "pass", twoOwners: "pass", emptyLandlord: "pass",
      staff: "pass", disabled: "pass", directUserTokenRls: "pass", importedDashboard,
      periods: ["2026-08", "2026-09"], partialPayment: "pass", timing: "pass", performance };
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
