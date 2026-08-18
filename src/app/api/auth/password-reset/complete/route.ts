import { createPasswordResetHttpHandlers } from "@/lib/auth/password-reset-http";
import { createInsForgePasswordResetRepository } from "@/lib/insforge/password-reset-repository";

export const dynamic = "force-dynamic";

const handlers = createPasswordResetHttpHandlers({
  createRepository: createInsForgePasswordResetRepository,
});

export const POST = handlers.COMPLETE;
