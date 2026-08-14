import { createInsForgeRoomRepository } from "@/lib/insforge/room-repository";
import { validateRoomWriteRequest } from "@/lib/rooms/api";
import { withOperationalAuth } from "@/lib/server/operational-route";
import {
  createRoomForOperations,
  listRoomsForOperations,
} from "@/lib/rooms/service";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "rooms.list" },
  async ({ timer }) => {
    const repository = createInsForgeRoomRepository({ timer });
    return timer.measure("service", () =>
      listRoomsForOperations({ repository }),
    );
  },
);

export const POST = withOperationalAuth(
  { operation: "rooms.create" },
  async ({ timer }, request: Request) => {
    const validation = await timer.measure("validation", () =>
      validateRoomWriteRequest(request),
    );

    if (validation.error) {
      return validation.error;
    }

    const repository = createInsForgeRoomRepository({ timer });
    return timer.measure("service", () =>
      createRoomForOperations({
        repository,
        ...validation.data,
      }),
    );
  },
);
