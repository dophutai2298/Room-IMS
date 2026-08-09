export const contractQueryKeys = {
  all: ["contracts"] as const,
  room: (roomId: string) => [...contractQueryKeys.all, "room", roomId] as const,
};
