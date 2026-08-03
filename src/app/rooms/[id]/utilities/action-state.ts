export type UtilityMetricsActionState = {
  status: "idle" | "success" | "error";
  message: string | null;
  fieldErrors: {
    electricityNew?: string;
    waterNew?: string;
    month?: string;
    year?: string;
  };
  fields: {
    electricityNew: string;
    waterNew: string;
  };
};

export const initialUtilityMetricsActionState: UtilityMetricsActionState = {
  status: "idle",
  message: null,
  fieldErrors: {},
  fields: {
    electricityNew: "",
    waterNew: "",
  },
};
