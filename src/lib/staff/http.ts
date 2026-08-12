import "server-only";

import {
  logApiTiming,
  type ApiTimer,
  type ApiTimingSnapshot,
} from "@/lib/api/timing";
import { withOperationalAuth } from "@/lib/server/operational-route";
import type { OperationalAuthResult } from "@/lib/server/operational-auth-core";
import { validateCreateStaffRequest } from "./api";
import type { StaffRepository } from "./repository";
import {
  createStaffForOperations,
  listStaffForOperations,
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
        allowedRoles: ["landlord"],
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
        allowedRoles: ["landlord"],
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
  };
}
