import { validationApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { createInsForgeRoomRepository } from "@/lib/insforge/room-repository";
import { getRoomOperationsSummaryForOperations } from "@/lib/rooms/service";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const timer = createApiTimer("rooms.operations-summary");

  try {
    const { id } = await params;

    if (!id) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(
        validationApiError({
          message: "room id is required",
          details: { fieldErrors: { id: "room id is required" } },
        }),
        meta,
      );
    }

    const auth = await resolveOperationalAppUser({ timer });

    if (auth.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(auth.error, meta);
    }

    const repository = createInsForgeRoomRepository({ timer });
    const result = await timer.measure("service", () =>
      getRoomOperationsSummaryForOperations({ repository, roomId: id }),
    );
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiResult(result, meta);
  } catch (error) {
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiException(error, meta);
  }
}
