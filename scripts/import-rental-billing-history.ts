import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const DATA_FILE = path.resolve("scripts/rental_billing_2024_2026.json");
const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

const CLEAR_ORDER = [
  "tenant_cccd_images",
  "invoices",
  "utility_metrics",
  "contracts",
  "tenants",
  "rooms",
  "utility_pricing",
] as const;

const INSERT_ORDER = [
  "utility_pricing",
  "rooms",
  "tenants",
  "contracts",
  "utility_metrics",
  "invoices",
] as const;

type BusinessTable = (typeof CLEAR_ORDER)[number];
type InsertTable = (typeof INSERT_ORDER)[number];

type DbResponse<T> = {
  data: T | null;
  error: unknown;
  count?: number | null;
};

type RawBillingRow = {
  room: string;
  tenant: string;
  session: string;
  electricity_old: number;
  electricity_new: number;
  water_old: number;
  water_new: number;
  electricity_fee: number;
  water_fee: number;
  room_fee: number;
  other_fee: number;
  other_fee_note: string;
  total_amount: number;
};

type BillingRow = RawBillingRow & {
  month: number;
  year: number;
  periodKey: number;
};

type RoomRecord = {
  id: string;
  name: string;
  floor: number | null;
  status: "Available" | "Occupied" | "Maintenance";
  base_price: number;
  owner_app_user_id: string;
};

type TenantRecord = {
  id: string;
  room_id: string;
  full_name: string;
  phone: string;
  date_of_birth: string;
  permanent_address: string;
  cccd_number: string;
  is_key_tenant: boolean;
  status: "Active" | "Moved Out";
  owner_app_user_id: string;
};

type ContractRecord = {
  id: string;
  room_id: string;
  key_tenant_id: string;
  deposit_amount: number;
  rent_amount: number;
  electricity_price_override: null;
  water_price_override: null;
  start_date: string;
  end_date: string | null;
  status: "Active" | "Terminated";
  owner_app_user_id: string;
};

type UtilityMetricRecord = {
  id: string;
  room_id: string;
  month: number;
  year: number;
  electricity_old: number;
  electricity_new: number;
  water_old: number;
  water_new: number;
  owner_app_user_id: string;
};

type UtilityPricingRecord = {
  id: string;
  effective_from: string;
  electricity_unit_price: number;
  water_unit_price: number;
  is_active: boolean;
  owner_app_user_id: string;
};

type InvoiceRecord = {
  id: string;
  room_id: string;
  month: number;
  year: number;
  electricity_fee: number;
  water_fee: number;
  room_fee: number;
  other_fee: number;
  other_fee_note: string | null;
  discount_amount: number;
  discount_note: string | null;
  total_amount: number;
  amount_paid: number;
  status: "Unpaid" | "Paid";
  owner_app_user_id: string;
};

type ImportRecords = {
  utility_pricing: UtilityPricingRecord[];
  rooms: RoomRecord[];
  tenants: TenantRecord[];
  contracts: ContractRecord[];
  utility_metrics: UtilityMetricRecord[];
  invoices: InvoiceRecord[];
};

type InsForgeAdminConfig = {
  baseUrl: string;
  apiKey: string;
};

type Config = InsForgeAdminConfig & {
  ownerAppUserId: string;
};

class InsForgeAdminRecordsClient {
  constructor(private readonly config: InsForgeAdminConfig) {}

  async selectIds(table: BusinessTable) {
    return this.request<Array<{ id: string }>>(
      "GET",
      `/api/database/records/${table}?select=id`,
    );
  }

  async deleteAll(table: BusinessTable) {
    return this.request<Array<{ id: string }>>(
      "DELETE",
      `/api/database/records/${table}?id=neq.${ZERO_UUID}&select=id`,
      undefined,
      {
        Prefer: "return=representation",
      },
    );
  }

  async insertRows(table: InsertTable, rows: ReadonlyArray<{ id: string }>) {
    return this.request<Array<{ id: string }>>(
      "POST",
      `/api/database/records/${table}?select=id`,
      rows,
      {
        Prefer: "return=representation",
      },
    );
  }

  async selectAppUserById(appUserId: string) {
    return this.request<Array<{ id: string; role: string; status?: string }>>(
      "GET",
      `/api/database/records/app_users?select=id,role,status&id=eq.${appUserId}&limit=1`,
    );
  }

  private async request<T>(
    method: "GET" | "POST" | "DELETE",
    pathname: string,
    body?: unknown,
    headers: Record<string, string> = {},
  ): Promise<DbResponse<T>> {
    const response = await fetch(`${this.config.baseUrl}${pathname}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${this.config.apiKey}`,
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...headers,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    const parsed = text ? parseJson(text) : null;

    if (!response.ok) {
      return {
        data: null,
        error: parsed ?? {
          message: `HTTP ${response.status} ${response.statusText}`,
          response: truncate(text),
        },
      };
    }

    return {
      data: parsed as T,
      error: null,
    };
  }
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));

  return {
    dryRun: args.has("--dry-run"),
    schemaOnly: args.has("--migrate-account-scope-schema-only"),
    migrateOnly: args.has("--migrate-account-scope-only"),
    confirmClear: args.has("--confirm-clear-business-data"),
  };
}

function requireInsForgeAdminConfig(): InsForgeAdminConfig {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.INSFORGE_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Missing InsForge config. Set NEXT_PUBLIC_INSFORGE_URL and INSFORGE_API_KEY in .env.",
    );
  }

  return { baseUrl, apiKey };
}

function requireConfig(): Config {
  const adminConfig = requireInsForgeAdminConfig();
  const ownerAppUserId = process.env.IMPORT_OWNER_APP_USER_ID?.trim();

  if (!ownerAppUserId) {
    throw new Error(
      "Missing InsForge import/backfill owner. Set IMPORT_OWNER_APP_USER_ID in .env.",
    );
  }

  if (!isUuid(ownerAppUserId)) {
    throw new Error("IMPORT_OWNER_APP_USER_ID must be a valid UUID.");
  }

  return { ...adminConfig, ownerAppUserId };
}

function getTargetLabel(baseUrl: string) {
  try {
    return new URL(baseUrl).host;
  } catch {
    return baseUrl;
  }
}

async function loadBillingRows() {
  const file = await readFile(DATA_FILE, "utf8");
  const input = JSON.parse(file) as Record<string, RawBillingRow[]>;
  const rows = Object.values(input)
    .flat()
    .map((row) => {
      const match = /^(\d{1,2})\/(\d{4})$/.exec(row.session);
      if (!match) {
        throw new Error(`Invalid session "${row.session}" for room ${row.room}.`);
      }

      const month = Number(match[1]);
      const year = Number(match[2]);

      if (month < 1 || month > 12) {
        throw new Error(`Invalid billing month "${row.session}" for room ${row.room}.`);
      }

      return {
        ...row,
        month,
        year,
        periodKey: year * 100 + month,
      };
    })
    .sort((left, right) => {
      if (left.periodKey !== right.periodKey) {
        return left.periodKey - right.periodKey;
      }

      return left.room.localeCompare(right.room, "en");
    });

  validateRows(rows);

  return rows;
}

function validateRows(rows: BillingRow[]) {
  const seenInvoices = new Set<string>();

  for (const row of rows) {
    if (!row.room.trim()) {
      throw new Error(`Missing room in ${row.session}.`);
    }

    if (!row.tenant.trim()) {
      throw new Error(`Missing tenant for room ${row.room} in ${row.session}.`);
    }

    if (row.electricity_new < row.electricity_old) {
      throw new Error(`Electricity reading goes backwards for room ${row.room} in ${row.session}.`);
    }

    if (row.water_new < row.water_old) {
      throw new Error(`Water reading goes backwards for room ${row.room} in ${row.session}.`);
    }

    const invoiceKey = `${row.room}:${row.periodKey}`;
    if (seenInvoices.has(invoiceKey)) {
      throw new Error(`Duplicate billing row for room ${row.room} in ${row.session}.`);
    }
    seenInvoices.add(invoiceKey);
  }
}

function buildImportRecords(rows: BillingRow[], ownerAppUserId: string): ImportRecords {
  const roomsByNumber = new Map<string, RoomRecord>();
  const tenantIdsByKey = new Map<string, string>();
  const latestPeriodKey = Math.max(...rows.map((row) => row.periodKey));
  const rowsByRoom = groupBy(rows, (row) => row.room);

  for (const [roomNumber, roomRows] of rowsByRoom) {
    const latestRow = [...roomRows].sort((left, right) => right.periodKey - left.periodKey)[0];
    roomsByNumber.set(roomNumber, {
      id: uuidFromSeed(`room:${roomNumber}`),
      name: `Phòng ${roomNumber}`,
      floor: floorFromRoomNumber(roomNumber),
      status: "Occupied",
      base_price: toVnd(latestRow.room_fee),
      owner_app_user_id: ownerAppUserId,
    });
  }

  const segments = [...rowsByRoom.entries()].flatMap(([roomNumber, roomRows]) =>
    buildTenantSegments(roomNumber, roomRows),
  );

  const latestTenantByRoom = new Map<string, string>();
  for (const [roomNumber, roomRows] of rowsByRoom) {
    const latestRow = [...roomRows].sort((left, right) => right.periodKey - left.periodKey)[0];
    latestTenantByRoom.set(roomNumber, latestRow.tenant);
  }

  for (const row of rows) {
    tenantIdsByKey.set(getTenantKey(row.room, row.tenant), uuidFromSeed(`tenant:${row.room}:${row.tenant}`));
  }

  const tenants = [...tenantIdsByKey.entries()]
    .map(([tenantKey, tenantId]) => {
      const [roomNumber, fullName] = splitTenantKey(tenantKey);
      const room = requireMapValue(roomsByNumber, roomNumber, "room");
      const active = latestTenantByRoom.get(roomNumber) === fullName;

      return {
        id: tenantId,
        room_id: room.id,
        full_name: fullName,
        phone: phoneFromSeed(tenantKey),
        date_of_birth: dateOfBirthFromSeed(tenantKey),
        permanent_address: addressFromSeed(tenantKey),
        cccd_number: cccdFromSeed(tenantKey),
        is_key_tenant: active,
        status: active ? "Active" : "Moved Out",
        owner_app_user_id: ownerAppUserId,
      } satisfies TenantRecord;
    })
    .sort((left, right) => left.full_name.localeCompare(right.full_name, "vi"));

  const contracts = segments.map((segment) => {
    const room = requireMapValue(roomsByNumber, segment.room, "room");
    const tenantId = requireMapValue(tenantIdsByKey, getTenantKey(segment.room, segment.tenant), "tenant");
    const rentAmount = toVnd(mostCommon(segment.rows.map((row) => row.room_fee)));

    return {
      id: uuidFromSeed(`contract:${segment.room}:${segment.tenant}:${segment.rows[0].session}`),
      room_id: room.id,
      key_tenant_id: tenantId,
      deposit_amount: rentAmount,
      rent_amount: rentAmount,
      electricity_price_override: null,
      water_price_override: null,
      start_date: firstDayOfMonth(segment.rows[0]),
      end_date: segment.active ? null : lastDayOfMonth(segment.rows.at(-1)!),
      status: segment.active ? "Active" : "Terminated",
      owner_app_user_id: ownerAppUserId,
    } satisfies ContractRecord;
  });

  return {
    utility_pricing: [
      {
        id: uuidFromSeed("utility-pricing:2024-10-01"),
        effective_from: "2024-10-01",
        electricity_unit_price: 3500,
        water_unit_price: 15000,
        is_active: false,
        owner_app_user_id: ownerAppUserId,
      },
      {
        id: uuidFromSeed("utility-pricing:2025-09-01"),
        effective_from: "2025-09-01",
        electricity_unit_price: 3500,
        water_unit_price: 17000,
        is_active: true,
        owner_app_user_id: ownerAppUserId,
      },
    ],
    rooms: [...roomsByNumber.values()].sort((left, right) => left.name.localeCompare(right.name, "vi")),
    tenants,
    contracts,
    utility_metrics: rows.map((row) => ({
      id: uuidFromSeed(`utility-metric:${row.room}:${row.periodKey}`),
      room_id: requireMapValue(roomsByNumber, row.room, "room").id,
      month: row.month,
      year: row.year,
      electricity_old: row.electricity_old,
      electricity_new: row.electricity_new,
      water_old: row.water_old,
      water_new: row.water_new,
      owner_app_user_id: ownerAppUserId,
    })),
    invoices: rows.map((row) => {
      const status = row.periodKey === latestPeriodKey ? "Unpaid" : "Paid";
      const totalAmount = toVnd(row.total_amount);
      const otherFee = toVnd(row.other_fee);
      const discountAmount = otherFee < 0 ? Math.abs(otherFee) : 0;
      const note = row.other_fee_note.trim() || null;

      return {
        id: uuidFromSeed(`invoice:${row.room}:${row.periodKey}`),
        room_id: requireMapValue(roomsByNumber, row.room, "room").id,
        month: row.month,
        year: row.year,
        electricity_fee: toVnd(row.electricity_fee),
        water_fee: toVnd(row.water_fee),
        room_fee: toVnd(row.room_fee),
        other_fee: Math.max(otherFee, 0),
        other_fee_note: otherFee > 0 ? note : null,
        discount_amount: discountAmount,
        discount_note: discountAmount > 0 ? note : null,
        total_amount: totalAmount,
        amount_paid: status === "Paid" ? totalAmount : 0,
        status,
        owner_app_user_id: ownerAppUserId,
      };
    }),
  };
}

function buildTenantSegments(room: string, rows: BillingRow[]) {
  const sortedRows = [...rows].sort((left, right) => left.periodKey - right.periodKey);
  const segments: Array<{ room: string; tenant: string; rows: BillingRow[]; active: boolean }> = [];

  for (const row of sortedRows) {
    const currentSegment = segments.at(-1);
    if (currentSegment && currentSegment.tenant === row.tenant) {
      currentSegment.rows.push(row);
      continue;
    }

    segments.push({
      room,
      tenant: row.tenant,
      rows: [row],
      active: false,
    });
  }

  if (segments.length > 0) {
    segments[segments.length - 1].active = true;
  }

  return segments;
}

function floorFromRoomNumber(roomNumber: string) {
  const parsed = Number.parseInt(roomNumber.trim()[0] ?? "", 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function groupBy<T>(values: T[], getKey: (value: T) => string) {
  const grouped = new Map<string, T[]>();

  for (const value of values) {
    const key = getKey(value);
    const bucket = grouped.get(key);

    if (bucket) {
      bucket.push(value);
    } else {
      grouped.set(key, [value]);
    }
  }

  return grouped;
}

function getTenantKey(room: string, tenant: string) {
  return `${room}::${tenant}`;
}

function splitTenantKey(key: string): [string, string] {
  const [room, tenant] = key.split("::");
  if (!room || !tenant) {
    throw new Error(`Invalid tenant key "${key}".`);
  }

  return [room, tenant];
}

function requireMapValue<T>(map: Map<string, T>, key: string, label: string) {
  const value = map.get(key);
  if (!value) {
    throw new Error(`Missing ${label}: ${key}.`);
  }

  return value;
}

function toVnd(valueInThousands: number) {
  return Math.round(valueInThousands * 1000);
}

function firstDayOfMonth(row: BillingRow) {
  return `${row.year}-${pad2(row.month)}-01`;
}

function lastDayOfMonth(row: BillingRow) {
  const date = new Date(Date.UTC(row.year, row.month, 0));
  return date.toISOString().slice(0, 10);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function mostCommon(values: number[]) {
  const counts = new Map<number, number>();

  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0][0];
}

function uuidFromSeed(seed: string) {
  const hash = createHash("sha256").update(seed).digest("hex");

  return [
    hash.slice(0, 8),
    hash.slice(8, 12),
    `4${hash.slice(13, 16)}`,
    `8${hash.slice(17, 20)}`,
    hash.slice(20, 32),
  ].join("-");
}

function numberFromSeed(seed: string) {
  return Number.parseInt(createHash("sha256").update(seed).digest("hex").slice(0, 12), 16);
}

function digitsFromSeed(seed: string, length: number) {
  const value = String(numberFromSeed(seed)).padStart(length, "0");
  return value.slice(-length);
}

function phoneFromSeed(seed: string) {
  return `09${digitsFromSeed(`phone:${seed}`, 8)}`;
}

function cccdFromSeed(seed: string) {
  return `079${digitsFromSeed(`cccd:${seed}`, 9)}`;
}

function dateOfBirthFromSeed(seed: string) {
  const value = numberFromSeed(`dob:${seed}`);
  const year = 1985 + (value % 18);
  const month = 1 + (Math.floor(value / 19) % 12);
  const day = 1 + (Math.floor(value / 239) % 28);

  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function addressFromSeed(seed: string) {
  const addresses = [
    "TP Hồ Chí Minh",
    "Đồng Nai",
    "Bình Dương",
    "Long An",
    "Tây Ninh",
    "Tiền Giang",
  ];

  return addresses[numberFromSeed(`address:${seed}`) % addresses.length];
}

function printSummary(records: ImportRecords) {
  console.log("Import summary");
  for (const table of INSERT_ORDER) {
    console.log(`- ${table}: ${records[table].length}`);
  }
  console.log("- latest billing period invoices: Unpaid");
  console.log("- previous billing period invoices: Paid");
  console.log("- app_users: preserved");
}

async function readTableCount(client: InsForgeAdminRecordsClient, table: BusinessTable) {
  const response = await client.selectIds(table);

  if (response.error) {
    throw new Error(`Could not count ${table}: ${formatDbError(response.error)}`);
  }

  return response.data?.length ?? 0;
}

async function readBusinessCounts(client: InsForgeAdminRecordsClient) {
  const counts = new Map<BusinessTable, number>();

  for (const table of CLEAR_ORDER) {
    counts.set(table, await readTableCount(client, table));
  }

  return counts;
}

async function clearBusinessData(client: InsForgeAdminRecordsClient) {
  console.log("Clearing existing business data");

  for (const table of CLEAR_ORDER) {
    const response = await client.deleteAll(table);

    if (response.error) {
      throw new Error(`Could not clear ${table}: ${formatDbError(response.error)}`);
    }

    console.log(`- ${table}: deleted ${response.data?.length ?? 0}`);
  }
}

async function insertTableRows(
  client: InsForgeAdminRecordsClient,
  table: InsertTable,
  rows: ReadonlyArray<{ id: string }>,
) {
  if (rows.length === 0) {
    return 0;
  }

  let inserted = 0;
  const chunkSize = 100;

  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const response = await client.insertRows(table, chunk);

    if (response.error) {
      throw new Error(`Could not insert ${table}: ${formatDbError(response.error)}`);
    }

    inserted += response.data?.length ?? chunk.length;
  }

  console.log(`- ${table}: inserted ${inserted}`);

  return inserted;
}

async function insertImportRecords(client: InsForgeAdminRecordsClient, records: ImportRecords) {
  console.log("Importing records");

  for (const table of INSERT_ORDER) {
    await insertTableRows(client, table, records[table]);
  }
}

async function ensureInvoiceOtherFeeAllowsDiscounts(config: Config) {
  const migration = {
    version: "202608290001",
    name: "allow-negative-invoice-other-fee-and-add-discount-fields",
    sql: `
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_note TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.invoices'::regclass
      AND conname = 'invoices_other_fee_check'
  ) THEN
    ALTER TABLE public.invoices DROP CONSTRAINT invoices_other_fee_check;
  END IF;
END $$;

UPDATE public.invoices
SET discount_amount = ABS(other_fee),
    discount_note = COALESCE(NULLIF(TRIM(discount_note), ''), other_fee_note),
    other_fee = 0
WHERE other_fee < 0
  AND discount_amount = 0;
`,
  };

  const response = await fetch(`${config.baseUrl}/api/database/migrations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(migration),
  });

  const text = await response.text();

  if (response.status === 409 || (response.status >= 400 && /already|duplicate/i.test(text))) {
    console.log("- migration allow-negative-invoice-other-fee: already applied");
    return;
  }

  if (!response.ok) {
    throw new Error(
      `Could not apply migration allow-negative-invoice-other-fee: HTTP ${response.status} ${truncate(text)}`,
    );
  }

  console.log("- migration allow-negative-invoice-other-fee: applied");
}

async function ensureAccountScopedBusinessSchema(config: InsForgeAdminConfig) {
  const migration = {
    version: "20260831010000",
    name: "account-scoped-business-schema-repair",
    sql: `
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;
ALTER TABLE public.app_users
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;

UPDATE public.app_users
SET owner_app_user_id = id
WHERE role = 'landlord'
  AND owner_app_user_id IS NULL;

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS floor INTEGER CHECK (floor IS NULL OR (floor >= 0 AND floor <= 200));
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.tenant_cccd_images
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.utility_metrics
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.utility_pricing
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;

ALTER TABLE public.rooms
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;
ALTER TABLE public.tenants
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;
ALTER TABLE public.tenant_cccd_images
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;
ALTER TABLE public.contracts
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;
ALTER TABLE public.utility_metrics
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;
ALTER TABLE public.utility_pricing
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;
ALTER TABLE public.invoices
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;

CREATE OR REPLACE FUNCTION public.current_app_user_owner_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(owner_app_user_id, id)
  FROM public.app_users
  WHERE auth_user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_app_user_owner_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_owner_id() TO authenticated;

CREATE INDEX IF NOT EXISTS app_users_owner_app_user_id_idx
  ON public.app_users (owner_app_user_id);
CREATE INDEX IF NOT EXISTS rooms_owner_app_user_id_name_idx
  ON public.rooms (owner_app_user_id, name);
CREATE INDEX IF NOT EXISTS tenants_owner_app_user_id_full_name_idx
  ON public.tenants (owner_app_user_id, full_name);
CREATE INDEX IF NOT EXISTS tenant_cccd_images_owner_app_user_id_tenant_id_idx
  ON public.tenant_cccd_images (owner_app_user_id, tenant_id);
CREATE INDEX IF NOT EXISTS contracts_owner_app_user_id_room_id_status_idx
  ON public.contracts (owner_app_user_id, room_id, status);
CREATE INDEX IF NOT EXISTS utility_metrics_owner_app_user_id_room_period_idx
  ON public.utility_metrics (owner_app_user_id, room_id, year, month);
CREATE INDEX IF NOT EXISTS utility_pricing_owner_app_user_id_effective_from_idx
  ON public.utility_pricing (owner_app_user_id, effective_from);
CREATE INDEX IF NOT EXISTS invoices_owner_app_user_id_room_period_idx
  ON public.invoices (owner_app_user_id, room_id, year, month);
`,
  };

  const response = await fetch(`${config.baseUrl}/api/database/migrations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(migration),
  });

  const text = await response.text();

  if (response.status === 409 || (response.status >= 400 && /already|duplicate/i.test(text))) {
    console.log("- migration account-scoped-business-schema: already applied");
    return;
  }

  if (!response.ok) {
    throw new Error(
      `Could not apply migration account-scoped-business-schema: HTTP ${response.status} ${truncate(text)}`,
    );
  }

  console.log("- migration account-scoped-business-schema: applied");
}

async function ensureAccountScopedBusinessData(config: Config) {
  const ownerId = config.ownerAppUserId;
  await assertBackfillOwnerExists(config);

  const migration = {
    version: "20260831020000",
    name: "account-scoped-business-data",
    sql: `
ALTER TABLE public.app_users
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE SET NULL;
ALTER TABLE public.app_users
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;

UPDATE public.app_users
SET owner_app_user_id = id
WHERE role = 'landlord'
  AND owner_app_user_id IS NULL;

UPDATE public.app_users
SET owner_app_user_id = '${ownerId}'::uuid
WHERE role = 'staff'
  AND owner_app_user_id IS NULL
  AND EXISTS (
    SELECT 1 FROM public.app_users WHERE id = '${ownerId}'::uuid
  );

ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS floor INTEGER CHECK (floor IS NULL OR (floor >= 0 AND floor <= 200));
ALTER TABLE public.rooms
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.tenant_cccd_images
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.utility_metrics
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.utility_pricing
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS owner_app_user_id UUID REFERENCES public.app_users(id) ON DELETE CASCADE;

ALTER TABLE public.rooms
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;
ALTER TABLE public.tenants
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;
ALTER TABLE public.tenant_cccd_images
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;
ALTER TABLE public.contracts
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;
ALTER TABLE public.utility_metrics
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;
ALTER TABLE public.utility_pricing
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;
ALTER TABLE public.invoices
  ALTER COLUMN owner_app_user_id TYPE UUID USING NULLIF(owner_app_user_id::text, '')::uuid;

UPDATE public.rooms SET owner_app_user_id = '${ownerId}'::uuid WHERE owner_app_user_id IS NULL;
UPDATE public.tenants SET owner_app_user_id = '${ownerId}'::uuid WHERE owner_app_user_id IS NULL;
UPDATE public.tenant_cccd_images SET owner_app_user_id = '${ownerId}'::uuid WHERE owner_app_user_id IS NULL;
UPDATE public.contracts SET owner_app_user_id = '${ownerId}'::uuid WHERE owner_app_user_id IS NULL;
UPDATE public.utility_metrics SET owner_app_user_id = '${ownerId}'::uuid WHERE owner_app_user_id IS NULL;
UPDATE public.utility_pricing SET owner_app_user_id = '${ownerId}'::uuid WHERE owner_app_user_id IS NULL;
UPDATE public.invoices SET owner_app_user_id = '${ownerId}'::uuid WHERE owner_app_user_id IS NULL;

CREATE INDEX IF NOT EXISTS app_users_owner_app_user_id_idx
  ON public.app_users (owner_app_user_id);
CREATE INDEX IF NOT EXISTS rooms_owner_app_user_id_name_idx
  ON public.rooms (owner_app_user_id, name);
CREATE INDEX IF NOT EXISTS tenants_owner_app_user_id_full_name_idx
  ON public.tenants (owner_app_user_id, full_name);
CREATE INDEX IF NOT EXISTS tenant_cccd_images_owner_app_user_id_tenant_id_idx
  ON public.tenant_cccd_images (owner_app_user_id, tenant_id);
CREATE INDEX IF NOT EXISTS contracts_owner_app_user_id_room_id_status_idx
  ON public.contracts (owner_app_user_id, room_id, status);
CREATE INDEX IF NOT EXISTS utility_metrics_owner_app_user_id_room_period_idx
  ON public.utility_metrics (owner_app_user_id, room_id, year, month);
CREATE INDEX IF NOT EXISTS utility_pricing_owner_app_user_id_effective_from_idx
  ON public.utility_pricing (owner_app_user_id, effective_from);
CREATE INDEX IF NOT EXISTS invoices_owner_app_user_id_room_period_idx
  ON public.invoices (owner_app_user_id, room_id, year, month);

CREATE OR REPLACE FUNCTION public.current_app_user_owner_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(owner_app_user_id, id)
  FROM public.app_users
  WHERE auth_user_id = auth.uid()
    AND status = 'active'
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.current_app_user_owner_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_app_user_owner_id() TO authenticated;

DROP POLICY IF EXISTS "authenticated_read_rooms" ON public.rooms;
DROP POLICY IF EXISTS "authenticated_insert_rooms" ON public.rooms;
DROP POLICY IF EXISTS "authenticated_landlord_update_rooms" ON public.rooms;
DROP POLICY IF EXISTS "authenticated_landlord_delete_rooms" ON public.rooms;
DROP POLICY IF EXISTS "authenticated_read_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_insert_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_landlord_update_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_landlord_delete_tenants" ON public.tenants;
DROP POLICY IF EXISTS "authenticated_read_tenant_cccd_images" ON public.tenant_cccd_images;
DROP POLICY IF EXISTS "authenticated_insert_tenant_cccd_images" ON public.tenant_cccd_images;
DROP POLICY IF EXISTS "authenticated_landlord_update_tenant_cccd_images" ON public.tenant_cccd_images;
DROP POLICY IF EXISTS "authenticated_landlord_delete_tenant_cccd_images" ON public.tenant_cccd_images;
DROP POLICY IF EXISTS "authenticated_read_contracts" ON public.contracts;
DROP POLICY IF EXISTS "authenticated_insert_contracts" ON public.contracts;
DROP POLICY IF EXISTS "authenticated_landlord_update_contracts" ON public.contracts;
DROP POLICY IF EXISTS "authenticated_landlord_delete_contracts" ON public.contracts;
DROP POLICY IF EXISTS "authenticated_read_utility_metrics" ON public.utility_metrics;
DROP POLICY IF EXISTS "authenticated_insert_utility_metrics" ON public.utility_metrics;
DROP POLICY IF EXISTS "authenticated_landlord_update_utility_metrics" ON public.utility_metrics;
DROP POLICY IF EXISTS "authenticated_landlord_delete_utility_metrics" ON public.utility_metrics;
DROP POLICY IF EXISTS "authenticated_read_utility_pricing" ON public.utility_pricing;
DROP POLICY IF EXISTS "authenticated_landlord_insert_utility_pricing" ON public.utility_pricing;
DROP POLICY IF EXISTS "authenticated_landlord_update_utility_pricing" ON public.utility_pricing;
DROP POLICY IF EXISTS "authenticated_landlord_delete_utility_pricing" ON public.utility_pricing;
DROP POLICY IF EXISTS "authenticated_read_invoices" ON public.invoices;
DROP POLICY IF EXISTS "authenticated_insert_invoices" ON public.invoices;
DROP POLICY IF EXISTS "authenticated_landlord_update_invoices" ON public.invoices;
DROP POLICY IF EXISTS "authenticated_landlord_delete_invoices" ON public.invoices;
DROP POLICY IF EXISTS "authenticated_landlord_read_app_users" ON public.app_users;

CREATE POLICY "authenticated_read_rooms"
ON public.rooms FOR SELECT TO authenticated
USING (owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_insert_rooms"
ON public.rooms FOR INSERT TO authenticated
WITH CHECK (owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_update_rooms"
ON public.rooms FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id())
WITH CHECK (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_delete_rooms"
ON public.rooms FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_read_tenants"
ON public.tenants FOR SELECT TO authenticated
USING (owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_insert_tenants"
ON public.tenants FOR INSERT TO authenticated
WITH CHECK (owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_update_tenants"
ON public.tenants FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id())
WITH CHECK (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_delete_tenants"
ON public.tenants FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_read_tenant_cccd_images"
ON public.tenant_cccd_images FOR SELECT TO authenticated
USING (owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_insert_tenant_cccd_images"
ON public.tenant_cccd_images FOR INSERT TO authenticated
WITH CHECK (owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_update_tenant_cccd_images"
ON public.tenant_cccd_images FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id())
WITH CHECK (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_delete_tenant_cccd_images"
ON public.tenant_cccd_images FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_read_contracts"
ON public.contracts FOR SELECT TO authenticated
USING (owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_insert_contracts"
ON public.contracts FOR INSERT TO authenticated
WITH CHECK (owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_update_contracts"
ON public.contracts FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id())
WITH CHECK (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_delete_contracts"
ON public.contracts FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_read_utility_metrics"
ON public.utility_metrics FOR SELECT TO authenticated
USING (owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_insert_utility_metrics"
ON public.utility_metrics FOR INSERT TO authenticated
WITH CHECK (owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_update_utility_metrics"
ON public.utility_metrics FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id())
WITH CHECK (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_delete_utility_metrics"
ON public.utility_metrics FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_read_utility_pricing"
ON public.utility_pricing FOR SELECT TO authenticated
USING (owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_insert_utility_pricing"
ON public.utility_pricing FOR INSERT TO authenticated
WITH CHECK (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_update_utility_pricing"
ON public.utility_pricing FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id())
WITH CHECK (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_delete_utility_pricing"
ON public.utility_pricing FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_read_invoices"
ON public.invoices FOR SELECT TO authenticated
USING (owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_insert_invoices"
ON public.invoices FOR INSERT TO authenticated
WITH CHECK (owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_update_invoices"
ON public.invoices FOR UPDATE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id())
WITH CHECK (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_delete_invoices"
ON public.invoices FOR DELETE TO authenticated
USING (public.current_app_user_is_landlord() AND owner_app_user_id = public.current_app_user_owner_id());

CREATE POLICY "authenticated_landlord_read_app_users"
ON public.app_users FOR SELECT TO authenticated
USING (
  public.current_app_user_is_landlord()
  AND (
    id = public.current_app_user_owner_id()
    OR owner_app_user_id = public.current_app_user_owner_id()
  )
);
`,
  };

  const response = await fetch(`${config.baseUrl}/api/database/migrations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(migration),
  });

  const text = await response.text();

  if (response.status === 409 || (response.status >= 400 && /already|duplicate/i.test(text))) {
    console.log("- migration account-scoped-business-data: already applied");
    return;
  }

  if (!response.ok) {
    throw new Error(
      `Could not apply migration account-scoped-business-data: HTTP ${response.status} ${truncate(text)}`,
    );
  }

  console.log("- migration account-scoped-business-data: applied");
}

async function assertBackfillOwnerExists(config: Config) {
  const client = new InsForgeAdminRecordsClient(config);
  const response = await client.selectAppUserById(config.ownerAppUserId);

  if (response.error) {
    throw new Error(`Could not verify IMPORT_OWNER_APP_USER_ID: ${formatDbError(response.error)}`);
  }

  const owner = response.data?.[0];

  if (!owner) {
    throw new Error(`IMPORT_OWNER_APP_USER_ID does not exist in app_users: ${config.ownerAppUserId}`);
  }

  if (owner.role !== "landlord") {
    throw new Error(`IMPORT_OWNER_APP_USER_ID must point to a landlord app_user, got role "${owner.role}".`);
  }

  if (owner.status && owner.status !== "active") {
    throw new Error(`IMPORT_OWNER_APP_USER_ID must be active, got status "${owner.status}".`);
  }
}

function truncate(value: string, maxLength = 800) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function parseJson(value: string) {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatDbError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

async function main() {
  const args = parseArgs();

  if (args.schemaOnly) {
    const config = requireInsForgeAdminConfig();
    console.log(`Target InsForge: ${getTargetLabel(config.baseUrl)}`);
    console.log("Preparing database schema for account-scoped business data");
    await ensureAccountScopedBusinessSchema(config);
    console.log("Account-scoped business schema migration completed.");
    return;
  }

  if (args.migrateOnly) {
    const config = requireConfig();
    console.log(`Target InsForge: ${getTargetLabel(config.baseUrl)}`);
    console.log(`Owner backfill target: ${config.ownerAppUserId}`);
    console.log("Preparing database for account-scoped business data");
    await ensureAccountScopedBusinessData(config);
    console.log("Account-scoped business data migration completed.");
    return;
  }

  const rows = await loadBillingRows();
  const config = args.dryRun ? null : requireConfig();
  const ownerAppUserId =
    config?.ownerAppUserId ??
    process.env.IMPORT_OWNER_APP_USER_ID?.trim() ??
    ZERO_UUID;
  if (ownerAppUserId !== ZERO_UUID && !isUuid(ownerAppUserId)) {
    throw new Error("IMPORT_OWNER_APP_USER_ID must be a valid UUID.");
  }
  const records = buildImportRecords(rows, ownerAppUserId);

  printSummary(records);

  if (args.dryRun) {
    console.log("Dry run only. No InsForge writes were performed.");
    return;
  }

  if (!args.confirmClear) {
    throw new Error(
      "Refusing to clear InsForge data without --confirm-clear-business-data.",
    );
  }

  if (!config) {
    throw new Error("Missing InsForge config for import.");
  }
  const client = new InsForgeAdminRecordsClient(config);

  console.log(`Target InsForge: ${getTargetLabel(config.baseUrl)}`);

  const beforeCounts = await readBusinessCounts(client);
  console.log("Existing business rows before clear");
  for (const table of CLEAR_ORDER) {
    console.log(`- ${table}: ${beforeCounts.get(table) ?? 0}`);
  }

  console.log("Preparing database for historical discounts");
  await ensureInvoiceOtherFeeAllowsDiscounts(config);
  console.log("Preparing database for account-scoped business data");
  await ensureAccountScopedBusinessData(config);
  await clearBusinessData(client);
  await insertImportRecords(client, records);

  const afterCounts = await readBusinessCounts(client);
  console.log("Business rows after import");
  for (const table of CLEAR_ORDER) {
    console.log(`- ${table}: ${afterCounts.get(table) ?? 0}`);
  }

  console.log("Rental billing history import completed.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
