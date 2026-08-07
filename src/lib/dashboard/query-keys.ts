export const dashboardQueryKeys = {
  all: ["dashboard"] as const,
  revenue: () => [...dashboardQueryKeys.all, "revenue"] as const,
};
