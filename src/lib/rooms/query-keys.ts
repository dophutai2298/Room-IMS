export const roomQueryKeys = {
  detail: (roomId: string) => ["rooms", "detail", roomId] as const,
  operationsSummary: (roomId: string) =>
    ["rooms", "operations-summary", roomId] as const,
};
