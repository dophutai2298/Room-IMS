export const staffQueryKeys = {
  all: ["staff"] as const,
  list: () => [...staffQueryKeys.all, "list"] as const,
};
