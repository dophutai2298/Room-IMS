import { readMvpSeededDataForOperations } from "@/lib/foundation/service";
import { createInsForgeFoundationRepository } from "@/lib/insforge/foundation-repository";
import { withOperationalAuth } from "@/lib/server/operational-route";

export const dynamic = "force-dynamic";

export const GET = withOperationalAuth(
  { operation: "foundation.seeded-data" },
  async ({ timer }) => {
    const repository = createInsForgeFoundationRepository({ timer });
    return timer.measure("service", () =>
      readMvpSeededDataForOperations({ repository }),
    );
  },
);
