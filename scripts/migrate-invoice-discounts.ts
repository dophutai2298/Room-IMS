type InsForgeAdminConfig = {
  baseUrl: string;
  apiKey: string;
};

function requireInsForgeAdminConfig(): InsForgeAdminConfig {
  const baseUrl = process.env.NEXT_PUBLIC_INSFORGE_URL?.trim().replace(/\/+$/, "");
  const apiKey = process.env.INSFORGE_API_KEY?.trim();

  if (!baseUrl || !apiKey) {
    throw new Error(
      "Missing InsForge config. Set NEXT_PUBLIC_INSFORGE_URL and INSFORGE_API_KEY in .env.",
    );
  }

  return { baseUrl, apiKey };
}

async function applyInvoiceDiscountMigration(config: InsForgeAdminConfig) {
  const migration = {
    version: "20260904010000",
    name: "invoice-discount-fields",
    sql: `
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0
    CHECK (discount_amount >= 0);

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS discount_note TEXT;

UPDATE public.invoices
SET discount_amount = ABS(other_fee),
    discount_note = COALESCE(NULLIF(TRIM(discount_note), ''), other_fee_note),
    other_fee = 0
WHERE other_fee < 0
  AND discount_amount = 0;
`,
  };

  const response = await fetch(`${config.baseUrl}/api/database/migrations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(migration),
  });
  const text = await response.text();

  if (response.status === 409 || (response.status >= 400 && /already|duplicate/i.test(text))) {
    console.log("- migration invoice-discount-fields: already applied");
    return;
  }

  if (!response.ok) {
    throw new Error(
      `Could not apply migration invoice-discount-fields: HTTP ${response.status} ${truncate(text)}`,
    );
  }

  console.log("- migration invoice-discount-fields: applied");
}

function truncate(value: string, maxLength = 800) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

async function main() {
  const config = requireInsForgeAdminConfig();
  console.log(`Target InsForge: ${config.baseUrl}`);
  await applyInvoiceDiscountMigration(config);
  console.log("Invoice discount migration completed.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
