import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import {
  buildUtilityPricingList,
  type UtilityPricingListItem,
} from "@/lib/utility-pricing/presenter";
import type {
  CreateUtilityPricingInput,
  DeactivateUtilityPricingInput,
  UtilityPricingRepository,
} from "@/lib/utility-pricing/repository";
import { appError, fail, ok, type AppResult, toAppBackendError } from "./errors";
import { createInsForgeServerClient } from "./server";
import type { UtilityPricingRecord } from "./types";

type QueryResponse<T> = {
  data: T | null;
  error: unknown;
};

type InsForgeServerClient = Awaited<ReturnType<typeof createInsForgeServerClient>>;

export function createInsForgeUtilityPricingRepository({
  timer,
}: {
  timer?: ApiTimer;
} = {}): UtilityPricingRepository {
  let clientPromise: Promise<InsForgeServerClient> | null = null;
  const getClient = () => {
    clientPromise ??= createInsForgeServerClient({ timer });
    return clientPromise;
  };

  return {
    async listPricing() {
      const query = () => readUtilityPricingFromInsForge({ getClient });

      return timer
        ? timer.measure("repository.insforge.utility-pricing-list", query)
        : query();
    },
    async createPricing(input) {
      const query = () => createUtilityPricingInInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.utility-pricing-create", query)
        : query();
    },
    async deactivatePricing(input) {
      const query = () =>
        deactivateUtilityPricingInInsForge({ ...input, getClient });

      return timer
        ? timer.measure("repository.insforge.utility-pricing-deactivate", query)
        : query();
    },
  };
}

async function readUtilityPricingFromInsForge({
  getClient,
}: {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<UtilityPricingListItem[]>> {
  try {
    const client = await getClient();
    const response = (await client.database
      .from("utility_pricing")
      .select(utilityPricingSelect)
      .order("effective_from")) as QueryResponse<UtilityPricingRecord[]>;

    if (response.error) {
      return fail(response.error, "Could not read Utility Pricing");
    }

    return ok(
      buildUtilityPricingList(
        (response.data ?? []) as unknown as UtilityPricingRecord[],
      ),
    );
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function createUtilityPricingInInsForge({
  effectiveFrom,
  electricityUnitPrice,
  waterUnitPrice,
  getClient,
}: CreateUtilityPricingInput & {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<UtilityPricingListItem>> {
  try {
    const client = await getClient();
    const activePricingResponse = (await client.database
      .from("utility_pricing")
      .select("id")
      .eq("is_active", true)) as QueryResponse<Array<Pick<UtilityPricingRecord, "id">>>;

    if (activePricingResponse.error) {
      return fail(
        activePricingResponse.error,
        "Could not read active Utility Pricing",
      );
    }

    const insertResponse = (await client.database
      .from("utility_pricing")
      .insert({
        effective_from: effectiveFrom,
        electricity_unit_price: electricityUnitPrice,
        water_unit_price: waterUnitPrice,
        is_active: true,
        updated_at: new Date().toISOString(),
      })
      .select(utilityPricingSelect)
      .limit(1)) as QueryResponse<UtilityPricingRecord[]>;

    if (insertResponse.error) {
      return fail(insertResponse.error, "Could not create Utility Pricing");
    }

    const insertedPricing = insertResponse.data?.[0];

    if (!insertedPricing) {
      return fail(
        new Error("Utility Pricing create returned no rows"),
        "Could not create Utility Pricing",
      );
    }

    const activePricingIds = (activePricingResponse.data ?? [])
      .map((pricing) => pricing.id)
      .filter((id) => id !== insertedPricing.id);

    for (const pricingId of activePricingIds) {
      const deactivateResponse = await client.database
        .from("utility_pricing")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pricingId);

      if (deactivateResponse.error) {
        return fail(
          deactivateResponse.error,
          "Could not supersede older Utility Pricing",
        );
      }
    }

    return ok(buildUtilityPricingList([insertedPricing])[0]);
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

async function deactivateUtilityPricingInInsForge({
  pricingId,
  getClient,
}: DeactivateUtilityPricingInput & {
  getClient: () => Promise<InsForgeServerClient>;
}): Promise<AppResult<UtilityPricingListItem>> {
  try {
    const client = await getClient();
    const response = (await client.database
      .from("utility_pricing")
      .update({
        is_active: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pricingId)
      .select(utilityPricingSelect)
      .limit(1)) as QueryResponse<UtilityPricingRecord[]>;

    if (response.error) {
      return fail(response.error, "Could not deactivate Utility Pricing");
    }

    const pricing = response.data?.[0];

    if (!pricing) {
      return appError({
        message: "Utility Pricing was not found.",
        code: "UTILITY_PRICING_NOT_FOUND",
        statusCode: 404,
      });
    }

    return ok(buildUtilityPricingList([pricing])[0]);
  } catch (error) {
    return { data: null, error: toAppBackendError(error) };
  }
}

const utilityPricingSelect = [
  "id",
  "effective_from",
  "electricity_unit_price",
  "water_unit_price",
  "is_active",
].join(", ");
