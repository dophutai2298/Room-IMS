import "server-only";

import type { createInsForgeServerClient } from "@/lib/insforge/server";
import { createSupabaseServerClient } from "./server";

/** Transitional query adapter: the existing billing repositories use the
 * PostgREST-compatible `database.from` surface. Supabase exposes `from` at
 * the client root; no InsForge client or network request is created here. */
export async function createSupabaseBillingClient(): Promise<Awaited<ReturnType<typeof createInsForgeServerClient>>> {
  const client = await createSupabaseServerClient();
  return { database: { from: client.from.bind(client) } } as unknown as Awaited<ReturnType<typeof createInsForgeServerClient>>;
}
