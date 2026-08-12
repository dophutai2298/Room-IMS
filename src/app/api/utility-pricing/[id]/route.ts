import { validationApiError } from "@/lib/api/errors";
import { createInsForgeUtilityPricingRepository } from "@/lib/insforge/utility-pricing-repository";
import { withOperationalAuth } from "@/lib/server/operational-route";
import { deactivateUtilityPricingForOperations } from "@/lib/utility-pricing/service";

export const dynamic = "force-dynamic";

export const PATCH = withOperationalAuth(
  {
    operation: "utility-pricing.deactivate",
    allowedRoles: ["landlord"],
    forbiddenMessage: "Only Landlords can manage Utility Pricing.",
  },
  async ({ timer }, _request: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;

    if (!id) {
      return validationApiError({
        message: "Utility Pricing id is required.",
        details: { fieldErrors: { id: "Utility Pricing id is required." } },
      });
    }

    const repository = createInsForgeUtilityPricingRepository({ timer });
    return timer.measure("service", () =>
      deactivateUtilityPricingForOperations({
        repository,
        pricingId: id,
      }),
    );
  },
);
