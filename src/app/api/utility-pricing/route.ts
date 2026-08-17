import { createInsForgeUtilityPricingRepository } from "@/lib/insforge/utility-pricing-repository";
import { validateCreateUtilityPricingRequest } from "@/lib/utility-pricing/api";
import {
  createUtilityPricingForOperations,
  listUtilityPricingForOperations,
} from "@/lib/utility-pricing/service";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "utility-pricing.list" },
  async ({ timer }) => {
    const repository = createInsForgeUtilityPricingRepository({ timer });
    return timer.measure("service", () =>
      listUtilityPricingForOperations({ repository }),
    );
  },
);

export const POST = withOperationalAuth(
  {
    operation: "utility-pricing.create",
    allowedRoles: ["landlord"],
    forbiddenMessage: "Chỉ Admin mới được quyền thao tác.",
  },
  async ({ timer }, request: Request) => {
    const validation = await timer.measure("validation", () =>
      validateCreateUtilityPricingRequest(request),
    );

    if (validation.error) {
      return validation.error;
    }

    const repository = createInsForgeUtilityPricingRepository({ timer });
    return timer.measure("service", () =>
      createUtilityPricingForOperations({
        repository,
        ...validation.data,
      }),
    );
  },
);
