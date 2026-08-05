import { apiException, apiResult } from "@/lib/api/response";
import { createApiTimer } from "@/lib/api/timing";
import { readMvpSeededData } from "@/lib/insforge/rental-repository";

export const dynamic = "force-dynamic";

export async function GET() {
  const timer = createApiTimer("foundation.seeded-data");

  try {
    const result = await timer.measure("service", () => readMvpSeededData());

    return apiResult(result, { timing: timer.snapshot() });
  } catch (error) {
    return apiException(error, { timing: timer.snapshot() });
  }
}
