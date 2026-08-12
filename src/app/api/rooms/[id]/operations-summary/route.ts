import { validationApiError } from "@/lib/api/errors";
import { createInsForgeRoomRepository } from "@/lib/insforge/room-repository";
import { getRoomOperationsSummaryForOperations } from "@/lib/rooms/service";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "rooms.operations-summary" },
  async ({ timer }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    if (!id) {
      return validationApiError({
        message: "room id is required",
        details: { fieldErrors: { id: "room id is required" } },
      });
    }

    const repository = createInsForgeRoomRepository({ timer });
    return timer.measure("service", () =>
      getRoomOperationsSummaryForOperations({ repository, roomId: id }),
    );
  },
);
