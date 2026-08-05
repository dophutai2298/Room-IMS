import { validationApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer } from "@/lib/api/timing";
import { touchRoom } from "@/lib/insforge/rental-repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const timer = createApiTimer("foundation.rooms.touch");
  const body = (await request.json().catch(() => null)) as { roomId?: string } | null;
  const roomId = body?.roomId;

  if (!roomId) {
    return apiFailure(
      validationApiError({
        message: "roomId is required",
        details: { fieldErrors: { roomId: "roomId is required" } },
      }),
      { timing: timer.snapshot() },
    );
  }

  try {
    const result = await timer.measure("service", () => touchRoom(roomId));

    return apiResult(result, { timing: timer.snapshot() });
  } catch (error) {
    return apiException(error, { timing: timer.snapshot() });
  }
}
