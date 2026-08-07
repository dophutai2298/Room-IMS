export const invoiceQueryKeys = {
  all: ["invoices"] as const,
  list: () => [...invoiceQueryKeys.all, "list"] as const,
};

