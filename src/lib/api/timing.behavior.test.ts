import assert from "node:assert/strict";
import test from "node:test";

import {
  createApiTimer,
  getActiveApiTimer,
  logApiTiming,
  runWithApiTimer,
} from "./timing";

test("api timer records request id, spans, and safe attributes", async () => {
  const timer = createApiTimer("rooms.list");

  await timer.measure(
    "repository.insforge.rooms-list",
    async () => "done",
    {
      operationCategory: "database",
      endpointCategory: "rest/v1/rooms?keys=select",
      status: 200,
    },
  );

  const snapshot = timer.snapshot();

  assert.equal(snapshot.operation, "rooms.list");
  assert.match(snapshot.requestId ?? "", /^[0-9a-f-]{36}$/);
  assert.equal(snapshot.spans.length, 1);
  assert.equal(snapshot.spans[0]?.name, "repository.insforge.rooms-list");
  assert.equal(snapshot.spans[0]?.attributes?.operationCategory, "database");
  assert.equal(snapshot.spans[0]?.attributes?.status, 200);
});

test("api timer can be read from the current async request context", async () => {
  const timer = createApiTimer("dashboard.revenue");

  await runWithApiTimer(timer, async () => {
    await Promise.resolve();
    assert.equal(getActiveApiTimer()?.requestId, timer.requestId);
  });

  assert.equal(getActiveApiTimer(), undefined);
});

test("production timing logs are opt-in and never emitted by default", () => {
  const originalEnvironment = process.env.NODE_ENV;
  const originalEnabled = process.env.API_TIMING_LOG_ENABLED;
  const originalConsoleInfo = console.info;
  const messages: unknown[][] = [];
  Object.assign(process.env, { NODE_ENV: "production" });
  delete process.env.API_TIMING_LOG_ENABLED;
  console.info = (...values: unknown[]) => {
    messages.push(values);
  };

  try {
    logApiTiming(createApiTimer("invoices.list").snapshot());
    assert.equal(messages.length, 0);

    process.env.API_TIMING_LOG_ENABLED = "true";
    logApiTiming(createApiTimer("invoices.list").snapshot());
    assert.equal(messages.length, 1);
  } finally {
    console.info = originalConsoleInfo;
    restoreEnvironment("NODE_ENV", originalEnvironment);
    restoreEnvironment("API_TIMING_LOG_ENABLED", originalEnabled);
  }
});

function restoreEnvironment(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
