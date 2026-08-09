export const tenantQueryKeys = {
  all: ["tenants"] as const,
  list: (search = "") => [...tenantQueryKeys.all, "list", search] as const,
  room: (roomId: string) => [...tenantQueryKeys.all, "room", roomId] as const,
  detail: (tenantId: string) =>
    [...tenantQueryKeys.all, "detail", tenantId] as const,
};
