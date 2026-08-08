export const utilityPricingQueryKeys = {
  all: ["utility-pricing"] as const,
  list: () => [...utilityPricingQueryKeys.all, "list"] as const,
};
