export type InsForgeRuntimeConfig = {
  baseUrl: string;
  anonKey: string;
};

export type InsForgeAdminRuntimeConfig = {
  baseUrl: string;
  apiKey: string;
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

export function getInsForgeAdminConfig(): InsForgeAdminRuntimeConfig {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL;
  const apiKey = process.env.INSFORGE_API_KEY;

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Missing InsForge admin config. Set NEXT_PUBLIC_INSFORGE_URL and INSFORGE_API_KEY in your environment.",
    );
  }

  return { baseUrl, apiKey };
}

export function getInsForgeConfigStatus() {
  return {
    hasBaseUrl: Boolean(process.env.NEXT_PUBLIC_INSFORGE_URL),
    hasAnonKey: Boolean(process.env.NEXT_PUBLIC_INSFORGE_ANON_KEY),
    hasServerApiKey: Boolean(process.env.INSFORGE_API_KEY),
  };
}
