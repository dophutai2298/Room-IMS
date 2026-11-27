import { createStaffRepository } from "@/lib/backend/staff-repository";
import { createStaffHttpHandlers } from "@/lib/staff/http";

export const dynamic = "force-dynamic";

const handlers = createStaffHttpHandlers({
  createRepository: createStaffRepository,
});

export const GET = handlers.GET;
export const POST = handlers.POST;
