export type InsForgeRuntimeConfig = {
  baseUrl: string;
  anonKey: string;
};

const missingConfigMessage =
  "Missing InsForge config. Set NEXT_PUBLIC_INSFORGE_URL and NEXT_PUBLIC_INSFORGE_ANON_KEY in your environment.";

export function getInsForgeConfig(): InsForgeRuntimeConfig {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const anonKey = process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY;

  if (!baseUrl || !anonKey) {
    throw new Error(missingConfigMessage);
  }

  return { baseUrl, anonKey };
}

export function getInsForgeConfigStatus() {
  return {
    hasBaseUrl: Boolean(process.env.NEXT_PUBLIC_INSFORGE_URL),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY),
    hasServerApiKey: Boolean(process.env.INSFORGE_API_KEY),
  };
}
