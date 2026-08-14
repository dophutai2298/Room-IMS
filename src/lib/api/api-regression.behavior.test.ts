import assert from "node:assert/strict";
import test from "node:test";
import { QueryObserver } from "@tanstack/query-core";

import { fetchAppApi, AppApiClientError } from "./client";
import { createAppQueryClient } from "@/lib/query-client";
import { getAuthenticatedDashboardApiSmokeResponses } from "@/lib/dashboard/api-contract-smoke";
import {
  getAuthenticatedInvoiceListApiSmokeResponse,
  getRejectedInvoicePaymentApiSmokeResponses,
} from "@/lib/invoices/api-contract-smoke";
import { getAuthenticatedRoomApiSmokeResponses } from "@/lib/rooms/api-contract-smoke";
import { getAuthenticatedTenantApiSmokeResponses } from "@/lib/tenants/api-contract-smoke";
import { getAuthenticatedUtilityMetricsApiSmokeResponses } from "@/lib/utilities/api-contract-smoke";

test("representative API contracts retain success, error, and timing semantics", () => {
  const responses = [
    getAuthenticatedInvoiceListApiSmokeResponse(),
    getAuthenticatedRoomApiSmokeResponses().detail,
    getAuthenticatedDashboardApiSmokeResponses().revenue,
    getAuthenticatedTenantApiSmokeResponses().directory,
    getAuthenticatedTenantApiSmokeResponses().detail,
    getAuthenticatedUtilityMetricsApiSmokeResponses().screen,
  ];

  for (const response of responses) {
    assert.equal(response.ok, true);
    assert.ok(response.meta?.timing?.operation);
  }

  const rejected = getRejectedInvoicePaymentApiSmokeResponses();
  assert.equal(rejected.missingPartialPaymentAmount.ok, false);
  assert.equal(rejected.missingPartialPaymentAmount.error.status, 422);
  assert.equal(rejected.malformedPaymentAmount.ok, false);
  assert.equal(rejected.malformedPaymentAmount.error.status, 400);
});

test("API client preserves structured error behavior", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json(
      {
        ok: false,
        error: {
          kind: "auth",
          code: "AUTH_REQUIRED",
          message: "Authentication required.",
          status: 401,
        },
      },
      { status: 401 },
    );

  try {
    await assert.rejects(
      () => fetchAppApi("http://localhost/api/invoices"),
      (error: unknown) => {
        assert.ok(error instanceof AppApiClientError);
        assert.equal(error.code, "AUTH_REQUIRED");
        assert.equal(error.status, 401);
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("management queries expose pending and success states and keep one retry", async () => {
  const queryClient = createAppQueryClient();
  let resolveQuery: ((value: string) => void) | undefined;
  const queryPromise = new Promise<string>((resolve) => {
    resolveQuery = resolve;
  });
  const observer = new QueryObserver(queryClient, {
    queryKey: ["performance-regression", "loading-state"],
    queryFn: () => queryPromise,
  });
  const statuses: string[] = [];
  const unsubscribe = observer.subscribe((result) => {
    statuses.push(result.status);
  });

  resolveQuery?.("loaded");
  const result = await observer.refetch();
  unsubscribe();

  assert.ok(statuses.includes("pending"));
  assert.equal(result.status, "success");
  assert.equal(result.data, "loaded");
  assert.equal(queryClient.getDefaultOptions().queries?.retry, 1);
});

test("management queries retry once before exposing their error state", async () => {
  const queryClient = createAppQueryClient();
  let attempts = 0;

  await assert.rejects(
    () =>
      queryClient.fetchQuery({
        queryKey: ["performance-regression", "retry-error-state"],
        queryFn: async () => {
          attempts += 1;
          throw new Error("temporary failure");
        },
        retryDelay: 0,
      }),
    /temporary failure/,
  );

  assert.equal(attempts, 2);
  assert.equal(
    queryClient.getQueryState(["performance-regression", "retry-error-state"])
      ?.status,
    "error",
  );
});
