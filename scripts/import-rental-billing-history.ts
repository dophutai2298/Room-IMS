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
  status: "Available" | "Occupied" | "Maintenance";
  base_price: number;
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
};

type UtilityPricingRecord = {
  id: string;
  effective_from: string;
  electricity_unit_price: number;
  water_unit_price: number;
  is_active: boolean;
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
  total_amount: number;
  amount_paid: number;
  status: "Unpaid" | "Paid";
};

type ImportRecords = {
  utility_pricing: UtilityPricingRecord[];
  rooms: RoomRecord[];
  tenants: TenantRecord[];
  contracts: ContractRecord[];
  utility_metrics: UtilityMetricRecord[];
  invoices: InvoiceRecord[];
};

type Config = {
  baseUrl: string;
  apiKey: string;
};

class InsForgeAdminRecordsClient {
  constructor(private readonly config: Config) {}

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
    confirmClear: args.has("--confirm-clear-business-data"),
  };
}

function requireConfig(): Config {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.INSFORGE_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Missing InsForge config. Set NEXT_PUBLIC_INSFORGE_URL and INSFORGE_API_KEY in .env.",
    );
  }

  return { baseUrl, apiKey };
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

function buildImportRecords(rows: BillingRow[]): ImportRecords {
  const roomsByNumber = new Map<string, RoomRecord>();
  const tenantIdsByKey = new Map<string, string>();
  const latestPeriodKey = Math.max(...rows.map((row) => row.periodKey));
  const rowsByRoom = groupBy(rows, (row) => row.room);

  for (const [roomNumber, roomRows] of rowsByRoom) {
    const latestRow = [...roomRows].sort((left, right) => right.periodKey - left.periodKey)[0];
    roomsByNumber.set(roomNumber, {
      id: uuidFromSeed(`room:${roomNumber}`),
      name: `Phòng ${roomNumber}`,
      status: "Occupied",
      base_price: toVnd(latestRow.room_fee),
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
      },
      {
        id: uuidFromSeed("utility-pricing:2025-09-01"),
        effective_from: "2025-09-01",
        electricity_unit_price: 3500,
        water_unit_price: 17000,
        is_active: true,
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
    })),
    invoices: rows.map((row) => {
      const status = row.periodKey === latestPeriodKey ? "Unpaid" : "Paid";
      const totalAmount = toVnd(row.total_amount);

      return {
        id: uuidFromSeed(`invoice:${row.room}:${row.periodKey}`),
        room_id: requireMapValue(roomsByNumber, row.room, "room").id,
        month: row.month,
        year: row.year,
        electricity_fee: toVnd(row.electricity_fee),
        water_fee: toVnd(row.water_fee),
        room_fee: toVnd(row.room_fee),
        other_fee: toVnd(row.other_fee),
        other_fee_note: row.other_fee_note.trim() || null,
        total_amount: totalAmount,
        amount_paid: status === "Paid" ? totalAmount : 0,
        status,
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
    name: "allow-negative-invoice-other-fee",
    sql: `
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
  const rows = await loadBillingRows();
  const records = buildImportRecords(rows);

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

  const config = requireConfig();
  const client = new InsForgeAdminRecordsClient(config);

  console.log(`Target InsForge: ${getTargetLabel(config.baseUrl)}`);

  const beforeCounts = await readBusinessCounts(client);
  console.log("Existing business rows before clear");
  for (const table of CLEAR_ORDER) {
    console.log(`- ${table}: ${beforeCounts.get(table) ?? 0}`);
  }

  console.log("Preparing database for historical discounts");
  await ensureInvoiceOtherFeeAllowsDiscounts(config);
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
