export const invoiceQueryKeys = {
  all: ["invoices"] as const,
  list: () => [...invoiceQueryKeys.all, "list"] as const,
  payment: (invoiceId: string) =>
    [...invoiceQueryKeys.all, "payment", invoiceId] as const,
};
