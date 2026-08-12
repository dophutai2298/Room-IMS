import assert from "node:assert/strict";
import test from "node:test";

import { getSafeNextPath } from "./redirect";

test("auth redirect keeps local paths and rejects external-looking paths", () => {
  assert.equal(getSafeNextPath("/rooms/101?month=8"), "/rooms/101?month=8");
  assert.equal(getSafeNextPath("//evil.example/path"), "/");
  assert.equal(getSafeNextPath("/\\evil.example/path"), "/");
  assert.equal(getSafeNextPath("https://evil.example/path"), "/");
});
