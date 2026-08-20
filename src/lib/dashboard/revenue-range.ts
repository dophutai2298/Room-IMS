export const DASHBOARD_REVENUE_RANGE_OPTIONS = [
  { value: "3m", label: "3 tháng", monthCount: 3 },
  { value: "6m", label: "6 tháng", monthCount: 6 },
  { value: "1y", label: "1 năm", monthCount: 12 },
  { value: "2y", label: "2 năm", monthCount: 24 },
  { value: "all", label: "Tất cả các kỳ", monthCount: null },
] as const;

export type DashboardRevenueRange =
  (typeof DASHBOARD_REVENUE_RANGE_OPTIONS)[number]["value"];

export const DEFAULT_DASHBOARD_REVENUE_RANGE: DashboardRevenueRange = "6m";

export function normalizeDashboardRevenueRange(
  value: unknown,
): DashboardRevenueRange {
  return DASHBOARD_REVENUE_RANGE_OPTIONS.some(
    (option) => option.value === value,
  )
    ? (value as DashboardRevenueRange)
    : DEFAULT_DASHBOARD_REVENUE_RANGE;
}

export function getDashboardRevenueRangeDetails(
  range: DashboardRevenueRange,
) {
  return DASHBOARD_REVENUE_RANGE_OPTIONS.find(
    (option) => option.value === range,
  )!;
}
