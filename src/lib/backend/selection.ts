export type AppBackend = "insforge" | "supabase";

export function selectBackend(value: string | undefined): AppBackend {
  if (!value || value === "insforge") return "insforge";
  if (value === "supabase") return "supabase";
  throw new Error(`Unsupported APP_BACKEND: ${value}`);
}

export function getAppBackend(): AppBackend {
  return selectBackend(process.env.APP_BACKEND);
}
