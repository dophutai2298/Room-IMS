import { validationApiError } from "@/lib/api/errors";
import { touchRoomForOperations } from "@/lib/foundation/service";
import { createInsForgeFoundationRepository } from "@/lib/insforge/foundation-repository";
import {
  existingDataMutationForbiddenMessage,
  landlordOnlyRoles,
} from "@/lib/server/role-policy";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const POST = withOperationalAuth(
  {
    operation: "foundation.rooms.touch",
    allowedRoles: landlordOnlyRoles,
    forbiddenMessage: existingDataMutationForbiddenMessage,
  },
  async ({ timer }, request: Request) => {
    const body = (await request.json().catch(() => null)) as {
      roomId?: string;
    } | null;
    const roomId = body?.roomId;

    if (!roomId) {
      return validationApiError({
        message: "roomId is required",
        details: { fieldErrors: { roomId: "roomId is required" } },
      });
    }

    const repository = createInsForgeFoundationRepository({ timer });
    return timer.measure("service", () =>
      touchRoomForOperations({ repository, roomId }),
    );
  },
);
