import { createStaffRepository } from "@/lib/backend/staff-repository";
import { createStaffHttpHandlers } from "@/lib/staff/http";

export const dynamic = "force-dynamic";

const handlers = createStaffHttpHandlers({
  createRepository: createStaffRepository,
});

export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
