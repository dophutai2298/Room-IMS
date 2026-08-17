import { createInsForgeStaffRepository } from "@/lib/insforge/staff-repository";
import { createStaffHttpHandlers } from "@/lib/staff/http";

export const dynamic = "force-dynamic";

const handlers = createStaffHttpHandlers({
  createRepository: createInsForgeStaffRepository,
});

export const PATCH = handlers.PATCH;
export const DELETE = handlers.DELETE;
