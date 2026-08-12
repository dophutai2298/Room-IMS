import assert from "node:assert/strict";
import test from "node:test";

import { createApiTimer } from "@/lib/api/timing";
import {
  buildSafeInsForgeRequestMetadata,
  createTracedInsForgeFetch,
} from "./tracing";

test("traced InsForge fetch records sanitized request metadata", async () => {
  const timer = createApiTimer("tenants.detail");
  const tracedFetch = createTracedInsForgeFetch({
    timer,
    fetchImpl: async () => Response.json({ ok: true }, { status: 200 }),
  });

  await tracedFetch(
    "https://api.insforge.dev/rest/v1/tenants/10000000-0000-0000-0000-000000000001?select=*&cccdNumber=079000000001",
    {
      method: "GET",
      headers: {
        Authorization: "Bearer secret-token",
      },
    },
  );

  const span = timer.snapshot().spans[0];

  assert.equal(span?.name, "insforge.database");
  assert.equal(span?.attributes?.method, "GET");
  assert.equal(span?.attributes?.status, 200);
  assert.equal(span?.attributes?.retryAttempt, 1);
  assert.equal(span?.attributes?.retryCount, 0);
  assert.equal(
    span?.attributes?.endpointCategory,
    "rest/v1/tenants/:id?keys=cccdNumber,select",
  );
  assert.doesNotMatch(JSON.stringify(span), /079000000001|secret-token/);
});

test("safe InsForge metadata uses only path categories and query keys", () => {
  const metadata = buildSafeInsForgeRequestMetadata(
    "https://api.insforge.dev/api/auth/users?search=dophutai.2298@gmail.com&token=secret",
    { method: "POST" },
  );

  assert.equal(metadata.method, "POST");
  assert.equal(metadata.operationCategory, "auth");
  assert.equal(
    metadata.endpointCategory,
    "api/auth/users?keys=redacted,search",
  );
  assert.doesNotMatch(JSON.stringify(metadata), /dophutai|secret/);
});
