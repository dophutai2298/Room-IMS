export type InvoiceGenerationActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  invoiceId: string | null;
  fieldErrors: {
    otherFee?: string;
    otherFeeNote?: string;
    month?: string;
    year?: string;
  };
  fields: {
    otherFee: string;
    otherFeeNote: string;
  };
};

export const initialInvoiceGenerationActionState: InvoiceGenerationActionState = {
  status: "idle",
  message: null,
  invoiceId: null,
  fieldErrors: {},
  fields: {
    otherFee: "",
    otherFeeNote: "",
  },
};
