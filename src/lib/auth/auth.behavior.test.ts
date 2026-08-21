import assert from "node:assert/strict";
import test from "node:test";

import { getSafeNextPath } from "./redirect";
import {
  readJwtSubject,
  readValidatedSessionAndAppUser,
} from "./session-candidate";

test("auth redirect keeps local paths and rejects external-looking paths", () => {
  assert.equal(getSafeNextPath("/rooms/101?month=8"), "/rooms/101?month=8");
  assert.equal(getSafeNextPath("//evil.example/path"), "/");
  assert.equal(getSafeNextPath("/\\evil.example/path"), "/");
  assert.equal(getSafeNextPath("https://evil.example/path"), "/");
});

test("operational Auth starts session validation and matching app-user lookup in parallel", async () => {
  const events: string[] = [];
  const result = await readValidatedSessionAndAppUser({
    candidateAuthUserId: "auth-user-1",
    readSession: async () => {
      events.push("session:start");
      await Promise.resolve();
      events.push("session:end");
      return { data: { id: "auth-user-1" }, error: null };
    },
    readAppUser: async (authUserId) => {
      events.push(`app-user:start:${authUserId}`);
      await Promise.resolve();
      events.push("app-user:end");
      return { data: { id: "app-user-1" }, error: null };
    },
  });

  assert.deepEqual(events.slice(0, 2), [
    "session:start",
    "app-user:start:auth-user-1",
  ]);
  assert.equal(result.session.data?.id, "auth-user-1");
  assert.equal(result.appUser?.data?.id, "app-user-1");
});

test("operational Auth never trusts a JWT candidate that differs from the validated session", async () => {
  const appUserLookups: string[] = [];
  const result = await readValidatedSessionAndAppUser({
    candidateAuthUserId: "untrusted-user",
    readSession: async () => ({
      data: { id: "validated-user" },
      error: null,
    }),
    readAppUser: async (authUserId) => {
      appUserLookups.push(authUserId);
      return {
        data: { id: `app:${authUserId}` },
        error: null,
      };
    },
  });

  assert.deepEqual(appUserLookups, ["untrusted-user", "validated-user"]);
  assert.equal(result.appUser?.data?.id, "app:validated-user");
});

test("JWT subject decoding returns only a UUID subject", () => {
  const authUserId = "10000000-0000-4000-8000-000000000001";
  const payload = Buffer.from(JSON.stringify({ sub: authUserId })).toString(
    "base64url",
  );
  const nonUuidPayload = Buffer.from(
    JSON.stringify({ sub: "untrusted-user" }),
  ).toString("base64url");

  assert.equal(readJwtSubject(`header.${payload}.signature`), authUserId);
  assert.equal(readJwtSubject(`header.${nonUuidPayload}.signature`), null);
  assert.equal(readJwtSubject("not-a-jwt"), null);
});
