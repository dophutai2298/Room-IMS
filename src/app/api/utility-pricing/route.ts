import { forbiddenApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { createInsForgeUtilityPricingRepository } from "@/lib/insforge/utility-pricing-repository";
import { validateCreateUtilityPricingRequest } from "@/lib/utility-pricing/api";
import {
  createUtilityPricingForOperations,
  listUtilityPricingForOperations,
} from "@/lib/utility-pricing/service";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const timer = createApiTimer("utility-pricing.list");

  try {
    const auth = await resolveOperationalAppUser({ timer });

    if (auth.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(auth.error, meta);
    }

    const repository = createInsForgeUtilityPricingRepository({ timer });
    const result = await timer.measure("service", () =>
      listUtilityPricingForOperations({ repository }),
    );
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiResult(result, meta);
  } catch (error) {
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiException(error, meta);
  }
}

export async function POST(request: Request) {
  const timer = createApiTimer("utility-pricing.create");

  try {
    const validation = await timer.measure("validation", () =>
      validateCreateUtilityPricingRequest(request),
    );

    if (validation.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(validation.error, meta);
    }

    const auth = await resolveOperationalAppUser({ timer });

    if (auth.error) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(auth.error, meta);
    }

    if (auth.user.role !== "landlord") {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(
        forbiddenApiError("Only Landlords can manage Utility Pricing."),
        meta,
      );
    }

    const repository = createInsForgeUtilityPricingRepository({ timer });
    const result = await timer.measure("service", () =>
      createUtilityPricingForOperations({
        repository,
        ...validation.data,
      }),
    );
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiResult(result, meta);
  } catch (error) {
    const meta = { timing: timer.snapshot() };
    logApiTiming(meta.timing);

    return apiException(error, meta);
  }
}
