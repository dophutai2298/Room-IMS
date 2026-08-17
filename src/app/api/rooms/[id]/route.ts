import { validationApiError } from "@/lib/api/errors";
import { createInsForgeRoomRepository } from "@/lib/insforge/room-repository";
import { validateRoomWriteRequest } from "@/lib/rooms/api";
import { updateRoomForOperations } from "@/lib/rooms/service";
import {
  existingDataMutationForbiddenMessage,
  landlordOnlyRoles,
} from "@/lib/server/role-policy";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const PATCH = withOperationalAuth(
  {
    operation: "rooms.update",
    allowedRoles: landlordOnlyRoles,
    forbiddenMessage: existingDataMutationForbiddenMessage,
  },
  async ({ timer }, request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    if (!id) {
      return validationApiError({
        message: "room id is required",
        details: { fieldErrors: { id: "room id is required" } },
      });
    }

    const validation = await timer.measure("validation", () =>
      validateRoomWriteRequest(request),
    );

    if (validation.error) {
      return validation.error;
    }

    const repository = createInsForgeRoomRepository({ timer });
    return timer.measure("service", () =>
      updateRoomForOperations({
        repository,
        roomId: id,
        ...validation.data,
      }),
    );
  },
);
