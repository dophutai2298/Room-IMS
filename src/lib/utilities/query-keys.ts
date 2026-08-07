import type { BillingPeriod } from "./presenter";

export const utilityMetricsQueryKeys = {
  all: ["utility-metrics"] as const,
  room: (roomId: string) => [...utilityMetricsQueryKeys.all, "room", roomId] as const,
  screen: (roomId: string, billingPeriod: BillingPeriod) =>
    [
      ...utilityMetricsQueryKeys.room(roomId),
      "screen",
      billingPeriod.year,
      billingPeriod.month,
    ] as const,
};

