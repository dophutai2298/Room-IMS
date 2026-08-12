import assert from "node:assert/strict";
import test from "node:test";

import {
  createApiTimer,
  getActiveApiTimer,
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
