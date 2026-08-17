import "server-only";

import {
  logApiTiming,
  type ApiTimer,
  type ApiTimingSnapshot,
} from "@/lib/api/timing";
import { withOperationalAuth } from "@/lib/server/operational-route";
import type { OperationalAuthResult } from "@/lib/server/operational-auth-core";
import { validationApiError } from "@/lib/api/errors";
import {
  adminOnlyForbiddenMessage,
  landlordOnlyRoles,
} from "@/lib/server/role-policy";
import {
  validateCreateStaffRequest,
  validateUpdateStaffRequest,
} from "./api";
import type { StaffRepository } from "./repository";
import {
  createStaffForOperations,
  deleteStaffForOperations,
  listStaffForOperations,
  updateStaffForOperations,
} from "./service";

type StaffHttpDependencies = {
  resolveAuth?: (input: { timer: ApiTimer }) => Promise<OperationalAuthResult>;
  createRepository(input: { timer: ApiTimer }): StaffRepository;
  logTiming?: (snapshot: ApiTimingSnapshot) => void;
};

export function createStaffHttpHandlers({
  resolveAuth,
  createRepository,
  logTiming = logApiTiming,
}: StaffHttpDependencies) {
  return {
    GET: withOperationalAuth(
      {
        operation: "staff.list",
        allowedRoles: landlordOnlyRoles,
        forbiddenMessage: adminOnlyForbiddenMessage,
        resolveAuth,
        logTiming,
      },
      async ({ timer }) => {
        const repository = createRepository({ timer });
        return timer.measure("service", () =>
          listStaffForOperations({ repository }),
        );
      },
    ),

    POST: withOperationalAuth(
      {
        operation: "staff.create",
        allowedRoles: landlordOnlyRoles,
        forbiddenMessage: adminOnlyForbiddenMessage,
        resolveAuth,
        logTiming,
      },
      async ({ timer }, request: Request) => {
        const validation = await timer.measure("validation", () =>
          validateCreateStaffRequest(request),
        );

        if (validation.error) {
          return validation.error;
        }

        const repository = createRepository({ timer });
        return timer.measure("service", () =>
          createStaffForOperations({ repository, ...validation.data }),
        );
      },
    ),

    PATCH: withOperationalAuth(
      {
        operation: "staff.update",
        allowedRoles: landlordOnlyRoles,
        forbiddenMessage: adminOnlyForbiddenMessage,
        resolveAuth,
        logTiming,
      },
      async (
        { timer },
        request: Request,
        { params }: { params: Promise<{ id: string }> },
      ) => {
        const { id } = await params;

        if (!id) {
          return staffIdRequiredError();
        }

        const validation = await timer.measure("validation", () =>
          validateUpdateStaffRequest(request),
        );

        if (validation.error) {
          return validation.error;
        }

        const repository = createRepository({ timer });
        return timer.measure("service", () =>
          updateStaffForOperations({
            repository,
            staffId: id,
            ...validation.data,
          }),
        );
      },
    ),

    DELETE: withOperationalAuth(
      {
        operation: "staff.delete",
        allowedRoles: landlordOnlyRoles,
        forbiddenMessage: adminOnlyForbiddenMessage,
        resolveAuth,
        logTiming,
      },
      async (
        { timer },
        _request: Request,
        { params }: { params: Promise<{ id: string }> },
      ) => {
        const { id } = await params;

        if (!id) {
          return staffIdRequiredError();
        }

        const repository = createRepository({ timer });
        return timer.measure("service", () =>
          deleteStaffForOperations({
            repository,
            staffId: id,
          }),
        );
      },
    ),
  };
}

function staffIdRequiredError() {
  return validationApiError({
    message: "Staff id is required.",
    details: { fieldErrors: { staffId: "Staff id is required." } },
  });
}
