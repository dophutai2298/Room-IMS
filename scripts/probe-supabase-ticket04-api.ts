/** Temporary live API probe. Never targets the legacy InsForge host. */
import { randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("Supabase probe configuration missing");
const projectRef = new URL(url).hostname.match(/^([a-z0-9-]+)\.supabase\.co$/)?.[1];
if (!projectRef || process.argv[2] !== "--apply" || process.argv[3] !== projectRef) throw new Error("Pass --apply and exact isolated project ref");
const origin = process.env.TICKET04_API_ORIGIN;
if (!origin || !/^http:\/\/localhost:\d+$/.test(origin)) throw new Error("Set TICKET04_API_ORIGIN to a localhost server with APP_BACKEND=supabase");
const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
function assert(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
type Actor = { id: string; authId: string; cookie: string };

async function main() {
  const suffix = randomUUID();
  const actors: Actor[] = [];
  const createdAuth: string[] = [], createdProfiles: string[] = [];
  let roomId: string | undefined, tenantId: string | undefined, contractId: string | undefined;
  const pricingIds: string[] = [], metricIds: string[] = [], invoiceIds: string[] = [];
  let primaryError: unknown;
  let cleanupFailed = false;
  let successReport: Record<string, unknown> | undefined;
  async function cleanup(work: () => Promise<boolean>) { try { if (!await work()) cleanupFailed = true; } catch { cleanupFailed = true; } }
  async function actor(label: string, role: "landlord" | "staff", ownerId?: string): Promise<Actor> {
    const email = `ticket04-${label}-${suffix}@example.test`;
    const password = randomBytes(32).toString("base64url");
    const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    assert(!created.error && created.data.user, "Probe auth creation failed");
    const id = randomUUID(), authId = created.data.user.id;
    createdAuth.push(authId);
    const profile = await admin.from("app_users").insert({ id, auth_user_id: authId, email,
      display_name: `Ticket 04 ${label}`, role, status: "active", credential_ready: true,
      owner_app_user_id: ownerId ?? id });
    assert(!profile.error, "Probe profile creation failed");
    createdProfiles.push(id);
    const signedIn = await fetch(`${origin}/api/auth/sign-in`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
    const body = await signedIn.json() as { ok?: boolean };
    assert(signedIn.ok && body.ok, "Probe API sign-in failed");
    const cookie = signedIn.headers.getSetCookie().map((part) => part.split(";")[0]).join("; ");
    assert(cookie, "Probe API sign-in returned no session cookie");
    const item = { id, authId, cookie }; actors.push(item); return item;
  }
  async function api(path: string, user: Actor, method = "GET", body?: Record<string, unknown>) {
    const response = await fetch(`${origin}${path}`, { method,
      headers: { cookie: user.cookie, ...(body ? { "content-type": "application/json" } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() as { ok: boolean; data?: Record<string, unknown>; error?: { code: string } } };
  }
  try {
    const landlord = await actor("landlord", "landlord");
    const outsider = await actor("outsider", "landlord");
    const staff = await actor("staff", "staff", landlord.id);
    const room = await admin.from("rooms").insert({ name: "Ticket 04 API Probe", base_price: 2_800_000,
      status: "Available", owner_app_user_id: landlord.id }).select("id").single();
    assert(!room.error && room.data, "Probe Room creation failed"); roomId = room.data.id;
    const tenant = await admin.from("tenants").insert({ room_id: roomId, full_name: "Ticket 04 API Probe",
      status: "Active", owner_app_user_id: landlord.id }).select("id").single();
    assert(!tenant.error && tenant.data, "Probe Tenant creation failed"); tenantId = tenant.data.id;
    const contract = await admin.from("contracts").insert({ room_id: roomId, key_tenant_id: tenantId,
      owner_app_user_id: landlord.id, start_date: "2026-01-01", rent_amount: 2_800_000,
      electricity_price_override: 3500, status: "Active", deposit_amount: 0 }).select("id").single();
    assert(!contract.error && contract.data, "Probe Contract creation failed"); contractId = contract.data.id;
    for (const [date, electricity, water] of [["2026-01-01", 3000, 16000], ["2026-10-01", 4000, 17000]] as const) {
      const price = await api("/api/utility-pricing", landlord, "POST", { effectiveFrom: date, electricityUnitPrice: electricity, waterUnitPrice: water });
      assert(price.status === 200 && price.body.ok, `Pricing API failed (${price.body.error?.code ?? price.status})`);
      pricingIds.push(String(price.body.data?.id));
    }
    const duplicatePrice = await api("/api/utility-pricing", landlord, "POST", { effectiveFrom: "2026-10-01", electricityUnitPrice: 9999, waterUnitPrice: 9999 });
    assert(duplicatePrice.status === 409, `Duplicate pricing date was not reported as conflict (${duplicatePrice.body.error?.code ?? duplicatePrice.status})`);
    const priceList = await api("/api/utility-pricing", staff);
    assert(priceList.status === 200 && priceList.body.ok, "Staff pricing read failed");
    const staffPrice = await api("/api/utility-pricing", staff, "POST", { effectiveFrom: "2026-11-01", electricityUnitPrice: 1, waterUnitPrice: 1 });
    assert(staffPrice.status === 403, "Staff pricing create was allowed");
    const metric = await api(`/api/rooms/${roomId}/utility-metrics`, staff, "PATCH", { month: 11, year: 2026, electricityNew: 10, waterNew: 3 });
    assert(metric.status === 200 && metric.body.ok, `Staff metric save failed (${metric.body.error?.code ?? metric.status})`);
    metricIds.push(String(metric.body.data?.id));
    const duplicate = await api(`/api/rooms/${roomId}/utility-metrics`, staff, "PATCH", { month: 11, year: 2026, electricityNew: 11, waterNew: 4 });
    assert(duplicate.status === 403, "Staff overwrote existing metrics");
    const landlordCorrection = await api(`/api/rooms/${roomId}/utility-metrics`, landlord, "PATCH", { month: 11, year: 2026, electricityNew: 10, waterNew: 3 });
    assert(landlordCorrection.status === 200 && landlordCorrection.body.data?.id === metric.body.data?.id, "Landlord could not update existing metrics");
    const generation = await api(`/api/rooms/${roomId}/invoices`, landlord, "POST", { month: 11, year: 2026,
      otherFee: 0, discountAmount: 62500, discountNote: "Ticket 04 test" });
    assert(generation.status === 200 && generation.body.ok, `Invoice generation failed (${generation.body.error?.code ?? generation.status})`);
    const invoiceId = String(generation.body.data?.id); invoiceIds.push(invoiceId);
    assert(Number(generation.body.data?.total_amount) === 2_823_500, "Contract override/price history/500 VND discount calculation differs");
    const payment = await api(`/api/invoices/${invoiceId}/payment`, landlord, "PATCH", { status: "Partially Paid", amountPaid: 1_000_000 });
    assert(payment.status === 200 && payment.body.ok, `Payment API failed (${payment.body.error?.code ?? payment.status})`);
    const staffRegeneration = await api(`/api/rooms/${roomId}/invoices`, staff, "POST", { month: 11, year: 2026, otherFee: 0, discountAmount: 0 });
    assert(staffRegeneration.status === 403, "Staff regenerated an existing Invoice");
    const nextPeriod = await api(`/api/rooms/${roomId}/utility-metrics?month=12&year=2026`, landlord);
    const suggested = nextPeriod.body.data?.invoiceOtherFeeDefaults as { amount?: number; note?: string } | undefined;
    assert(nextPeriod.status === 200 && suggested?.amount === 1_823_500 && suggested.note, "Previous partial balance was not suggested for the next period");
    const nextMetric = await api(`/api/rooms/${roomId}/utility-metrics`, landlord, "PATCH", { month: 12, year: 2026, electricityNew: 12, waterNew: 4 });
    assert(nextMetric.status === 200 && nextMetric.body.ok, "Next-period metric save failed");
    metricIds.push(String(nextMetric.body.data?.id));
    const nextInvoice = await api(`/api/rooms/${roomId}/invoices`, landlord, "POST", { month: 12, year: 2026, otherFee: 0, discountAmount: 0 });
    assert(nextInvoice.status === 200 && Number(nextInvoice.body.data?.other_fee) === 0, "Suggested debt persisted without explicit save");
    invoiceIds.push(String(nextInvoice.body.data?.id));
    const regenerated = await api(`/api/rooms/${roomId}/invoices`, landlord, "POST", { month: 12, year: 2026,
      otherFee: 1_823_500, otherFeeNote: "Previous balance", discountAmount: 0 });
    assert(regenerated.status === 200 && regenerated.body.data?.id === nextInvoice.body.data?.id
      && Number(regenerated.body.data?.other_fee) === 1_823_500, `Editable carry-forward did not persist on explicit Invoice update (${regenerated.body.error?.code ?? regenerated.status})`);
    const invoiceList = await api("/api/invoices", landlord);
    assert(invoiceList.status === 200 && invoiceList.body.ok, "Invoice list failed");
    const outsiderList = await api("/api/invoices", outsider);
    assert(outsiderList.status === 200 && outsiderList.body.ok && !(outsiderList.body.data as unknown as Array<{ id: string }>).some((item) => item.id === invoiceId), "Cross-owner Invoice list leaked");
    const pdf = await fetch(`${origin}/api/rooms/${roomId}/invoices/pdf?month=11&year=2026`, { headers: { cookie: landlord.cookie } });
    assert(pdf.status === 200 && pdf.headers.get("content-type")?.includes("application/pdf") && (await pdf.arrayBuffer()).byteLength > 500, "Invoice PDF failed");
    const foreignPdf = await fetch(`${origin}/api/rooms/${roomId}/invoices/pdf?month=11&year=2026`, { headers: { cookie: outsider.cookie } });
    assert(foreignPdf.status === 404, "Cross-owner PDF export was allowed");
    const staffPayment = await api(`/api/invoices/${invoiceId}/payment`, staff, "PATCH", { status: "Paid", amountPaid: 2_823_500 });
    assert(staffPayment.status === 403, "Staff payment update was allowed");
    successReport = { projectRef, api: "pass", pricingHistory: "pass", duplicatePricingConflict: "pass", contractOverride: "pass", discount62500: "pass", payment: "pass", carryForward: "pass", pdf: "pass", crossOwner: "pass", staff: "pass" };
  } catch (error) { primaryError = error; }
  finally {
    for (const [table, ids] of [["invoices", invoiceIds], ["utility_metrics", metricIds], ["utility_pricing", pricingIds]] as const)
      for (const id of ids) await cleanup(async () => !(await admin.from(table).delete().eq("id", id)).error);
    for (const [table, id] of [["contracts", contractId], ["tenants", tenantId], ["rooms", roomId]] as const)
      if (id) await cleanup(async () => !(await admin.from(table).delete().eq("id", id)).error);
    for (const id of createdProfiles.reverse()) await cleanup(async () => !(await admin.from("app_users").delete().eq("id", id)).error);
    for (const id of createdAuth.reverse()) await cleanup(async () => !(await admin.auth.admin.deleteUser(id)).error);
  }
  if (cleanupFailed) throw new Error("Ticket 04 probe cleanup failed; inspect isolated project");
  if (primaryError) throw primaryError;
  console.log(JSON.stringify(successReport));
}

void main().catch((error) => {
  console.error(JSON.stringify({ code: "TICKET04_API_PROBE_FAILED", message: error instanceof Error ? error.message : "API probe failed" }));
  process.exitCode = 1;
});
