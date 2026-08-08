import type { UtilityPricingRecord } from "@/lib/insforge/types";

export type UtilityPricingListItem = {
  id: string;
  effectiveFrom: string;
  effectiveFromLabel: string;
  electricityUnitPrice: number;
  waterUnitPrice: number;
  isActive: boolean;
  statusLabel: string;
};

export function buildUtilityPricingList(
  pricingRows: UtilityPricingRecord[],
): UtilityPricingListItem[] {
  return pricingRows
    .map((pricing) => ({
      id: pricing.id,
      effectiveFrom: pricing.effective_from,
      effectiveFromLabel: formatDateLabel(pricing.effective_from),
      electricityUnitPrice: toMoney(pricing.electricity_unit_price),
      waterUnitPrice: toMoney(pricing.water_unit_price),
      isActive: Boolean(pricing.is_active),
      statusLabel: pricing.is_active ? "Đang áp dụng" : "Lịch sử",
    }))
    .sort(comparePricingDescending);
}

function comparePricingDescending(
  left: UtilityPricingListItem,
  right: UtilityPricingListItem,
) {
  return (
    new Date(right.effectiveFrom).getTime() -
    new Date(left.effectiveFrom).getTime()
  );
}

function formatDateLabel(value: string) {
  const [year, month, day] = value.split("-");

  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function toMoney(value: number | string | null) {
  return Number(value ?? 0);
}
