export const roomQueryKeys = {
  all: ["rooms"] as const,
  list: () => [...roomQueryKeys.all, "list"] as const,
  detail: (roomId: string) => [...roomQueryKeys.all, "detail", roomId] as const,
  operationsSummary: (roomId: string) =>
    [...roomQueryKeys.all, "operations-summary", roomId] as const,
};
