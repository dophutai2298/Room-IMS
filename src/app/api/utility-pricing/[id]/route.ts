import { validationApiError, forbiddenApiError } from "@/lib/api/errors";
import { apiException, apiFailure, apiResult } from "@/lib/api/response";
import { createApiTimer, logApiTiming } from "@/lib/api/timing";
import { createInsForgeUtilityPricingRepository } from "@/lib/insforge/utility-pricing-repository";
import { resolveOperationalAppUser } from "@/lib/server/operational-auth";
import { deactivateUtilityPricingForOperations } from "@/lib/utility-pricing/service";

export const dynamic = "force-dynamic";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const timer = createApiTimer("utility-pricing.deactivate");

  try {
    const { id } = await params;

    if (!id) {
      const meta = { timing: timer.snapshot() };
      logApiTiming(meta.timing);

      return apiFailure(
        validationApiError({
          message: "Utility Pricing id is required.",
          details: { fieldErrors: { id: "Utility Pricing id is required." } },
        }),
        meta,
      );
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
      deactivateUtilityPricingForOperations({
        repository,
        pricingId: id,
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
