import type {
  ContractRecord,
  InvoiceRecord,
  RoomRecord,
  TenantRecord,
  UtilityMetricRecord,
} from "@/lib/insforge/types";

export type BillingPeriod = {
  month: number;
  year: number;
};

export type UtilityReadingView = {
  oldReading: number;
  newReading: number | null;
  consumption: number | null;
  unit: string;
};

export type UtilityMetricsView = {
  room: {
    id: string;
    name: string;
  };
  billingPeriod: BillingPeriod;
  periodLabel: string;
  persistedMetricId: string | null;
  keyTenantName: string | null;
  activeContractId: string | null;
  previousPeriodLabel: string | null;
  invoice: UtilityInvoiceSummary | null;
  electricity: UtilityReadingView;
  water: UtilityReadingView;
};

export type UtilityInvoiceSummary = {
  id: string;
  status: InvoiceRecord["status"];
  totalAmount: number;
  amountPaid: number;
  otherFee: number;
};

export function getDefaultBillingPeriod(now = new Date()): BillingPeriod {
  return {
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  };
}

export function normalizeBillingPeriod({
  month,
  year,
  fallback = getDefaultBillingPeriod(),
}: {
  month: string | string[] | undefined;
  year: string | string[] | undefined;
  fallback?: BillingPeriod;
}): BillingPeriod {
  const parsedMonth = parseIntegerSearchParam(month);
  const parsedYear = parseIntegerSearchParam(year);

  return {
    month:
      parsedMonth !== null && parsedMonth >= 1 && parsedMonth <= 12
        ? parsedMonth
        : fallback.month,
    year:
      parsedYear !== null && parsedYear >= 2000 && parsedYear <= 2100
        ? parsedYear
        : fallback.year,
  };
}

export function buildUtilityMetricsView({
  room,
  tenants,
  activeContract,
  metrics,
  invoices,
  billingPeriod,
}: {
  room: RoomRecord;
  tenants: TenantRecord[];
  activeContract: ContractRecord | null;
  metrics: UtilityMetricRecord[];
  invoices: InvoiceRecord[];
  billingPeriod: BillingPeriod;
}): UtilityMetricsView {
  const { currentMetric, previousMetric } = resolveUtilityMetricPeriod({
    metrics,
    billingPeriod,
  });
  const currentInvoice =
    invoices.find((invoice) => isSamePeriod(invoice, billingPeriod)) ?? null;
  const keyTenant = activeContract
    ? tenants.find((tenant) => tenant.id === activeContract.key_tenant_id)
    : null;

  const electricityOld = toNumber(
    currentMetric?.electricity_old ?? previousMetric?.electricity_new ?? 0,
  );
  const electricityNew = currentMetric
    ? toNumber(currentMetric.electricity_new)
    : null;
  const waterOld = toNumber(
    currentMetric?.water_old ?? previousMetric?.water_new ?? 0,
  );
  const waterNew = currentMetric ? toNumber(currentMetric.water_new) : null;

  return {
    room: {
      id: room.id,
      name: room.name,
    },
    billingPeriod,
    periodLabel: formatBillingPeriod(billingPeriod),
    persistedMetricId: currentMetric?.id ?? null,
    keyTenantName: keyTenant?.full_name ?? null,
    activeContractId: activeContract?.id ?? null,
    previousPeriodLabel: previousMetric
      ? formatBillingPeriod({
          month: toNumber(previousMetric.month),
          year: toNumber(previousMetric.year),
        })
      : null,
    invoice: currentInvoice
      ? {
          id: currentInvoice.id,
          status: currentInvoice.status,
          totalAmount: toNumber(currentInvoice.total_amount),
          amountPaid: toNumber(currentInvoice.amount_paid),
          otherFee: toNumber(currentInvoice.other_fee),
        }
      : null,
    electricity: {
      oldReading: electricityOld,
      newReading: electricityNew,
      consumption:
        electricityNew === null ? null : electricityNew - electricityOld,
      unit: "kWh",
    },
    water: {
      oldReading: waterOld,
      newReading: waterNew,
      consumption: waterNew === null ? null : waterNew - waterOld,
      unit: "m³",
    },
  };
}

export function getUtilityMetricBaseline({
  metrics,
  billingPeriod,
}: {
  metrics: UtilityMetricRecord[];
  billingPeriod: BillingPeriod;
}) {
  const { currentMetric, previousMetric } = resolveUtilityMetricPeriod({
    metrics,
    billingPeriod,
  });

  return {
    currentMetric: currentMetric ?? null,
    electricityOld: toNumber(
      currentMetric?.electricity_old ?? previousMetric?.electricity_new ?? 0,
    ),
    waterOld: toNumber(currentMetric?.water_old ?? previousMetric?.water_new ?? 0),
  };
}

export function formatBillingPeriod({ month, year }: BillingPeriod) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

function resolveUtilityMetricPeriod({
  metrics,
  billingPeriod,
}: {
  metrics: UtilityMetricRecord[];
  billingPeriod: BillingPeriod;
}) {
  return {
    currentMetric:
      metrics.find((metric) => isSamePeriod(metric, billingPeriod)) ?? null,
    previousMetric: findLatestMetricBeforePeriod(metrics, billingPeriod) ?? null,
  };
}

function findLatestMetricBeforePeriod(
  metrics: UtilityMetricRecord[],
  billingPeriod: BillingPeriod,
) {
  return metrics
    .filter((metric) => isBeforePeriod(metric, billingPeriod))
    .sort((left, right) => compareMetricPeriodDescending(left, right))[0];
}

function compareMetricPeriodDescending(
  left: UtilityMetricRecord,
  right: UtilityMetricRecord,
) {
  const leftYear = toNumber(left.year);
  const rightYear = toNumber(right.year);

  if (leftYear !== rightYear) {
    return rightYear - leftYear;
  }

  return toNumber(right.month) - toNumber(left.month);
}

function isSamePeriod(
  metric: { month: number | string; year: number | string },
  billingPeriod: BillingPeriod,
) {
  return (
    toNumber(metric.month) === billingPeriod.month &&
    toNumber(metric.year) === billingPeriod.year
  );
}

function isBeforePeriod(metric: UtilityMetricRecord, billingPeriod: BillingPeriod) {
  const metricYear = toNumber(metric.year);
  const metricMonth = toNumber(metric.month);

  return (
    metricYear < billingPeriod.year ||
    (metricYear === billingPeriod.year && metricMonth < billingPeriod.month)
  );
}

function parseIntegerSearchParam(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;

  if (!raw) {
    return null;
  }

  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function toNumber(value: number | string) {
  return Number(value);
}
