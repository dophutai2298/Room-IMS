import "server-only";

import type { ApiTimer } from "@/lib/api/timing";
import { createInsForgeUtilityMetricsRepository } from "@/lib/insforge/utility-metrics-repository";
import { createInsForgeUtilityPricingRepository } from "@/lib/insforge/utility-pricing-repository";
import { createInsForgeInvoiceRepository } from "@/lib/insforge/invoice-repository";
import { createInsForgeInvoiceGenerationRepository } from "@/lib/insforge/invoice-generation-repository";
import { createInsForgeInvoiceExportRepository } from "@/lib/insforge/invoice-export-repository";
import { createSupabaseBillingClient } from "@/lib/supabase/billing-client";
import { getAppBackend } from "./selection";

const options = ({ timer }: { timer?: ApiTimer } = {}) => ({
  timer,
  ...(getAppBackend() === "supabase" ? { clientFactory: createSupabaseBillingClient } : {}),
});

export const createUtilityMetricsRepository = (input: { timer?: ApiTimer } = {}) =>
  createInsForgeUtilityMetricsRepository(options(input));
export const createUtilityPricingRepository = (input: { timer?: ApiTimer } = {}) =>
  createInsForgeUtilityPricingRepository(options(input));
export const createInvoiceRepository = (input: { timer?: ApiTimer } = {}) =>
  createInsForgeInvoiceRepository(options(input));
export const createInvoiceGenerationRepository = (input: { timer?: ApiTimer } = {}) =>
  createInsForgeInvoiceGenerationRepository(options(input));
export const createInvoiceExportRepository = (input: { timer?: ApiTimer } = {}) =>
  createInsForgeInvoiceExportRepository(options(input));
