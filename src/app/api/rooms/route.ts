import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { createInsForgeRoomRepository } from "@/lib/insforge/room-repository";
import { validateRoomWriteRequest } from "@/lib/rooms/api";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";
import {
  createRoomForOperations,
  listRoomsForOperations,
} from "@/lib/rooms/service";

export const dynamic = "force-dynamic";

export async function GET() {
  const timer = createApiTimer("rooms.list");

  try {
    const auth = await resolveOperationalAppUser({ timer });

    if (auth.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(auth.error, meta);
    }

    const repository = createInsForgeRoomRepository({ timer });
    const result = await timer.measure("service", () =>
      listRoomsForOperations({ repository }),
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

export async function POST(request: Request) {
  const timer = createApiTimer("rooms.create");

  try {
    const validation = await timer.measure("validation", () =>
      validateRoomWriteRequest(request),
    );

    if (validation.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(validation.error, meta);
    }

    const auth = await resolveOperationalAppUser({ timer });

    if (auth.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(auth.error, meta);
    }

    const repository = createInsForgeRoomRepository({ timer });
    const result = await timer.measure("service", () =>
      createRoomForOperations({
        repository,
        ...validation.data,
      }),
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
