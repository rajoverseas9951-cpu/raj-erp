import assert from "node:assert/strict";
import test from "node:test";
// @ts-expect-error Node's TypeScript runner requires an explicit extension.
import { bearerRequestInit } from "../lib/bearer-request.ts";

test("vehicle creation uses stateless JSON bearer authentication", () => {
  const init = bearerRequestInit("vehicle-api-token", {
    method: "POST",
    body: JSON.stringify({ vehicle_number: "GJ01TEST1" }),
    credentials: "include",
    headers: {
      "X-XSRF-TOKEN": "stale-cookie-token",
      "X-CSRF-TOKEN": "stale-form-token",
    },
  });
  const headers = new Headers(init.headers);

  assert.equal(init.method, "POST");
  assert.equal(init.credentials, "omit");
  assert.equal(init.cache, "no-store");
  assert.equal(headers.get("Authorization"), "Bearer vehicle-api-token");
  assert.equal(headers.get("Accept"), "application/json");
  assert.equal(headers.get("Content-Type"), "application/json");
  assert.equal(headers.has("X-XSRF-TOKEN"), false);
  assert.equal(headers.has("X-CSRF-TOKEN"), false);
});

test("multipart mutations retain bearer auth without forcing content type", () => {
  const init = bearerRequestInit("upload-token", {
    method: "POST",
    body: new FormData(),
  });
  const headers = new Headers(init.headers);

  assert.equal(init.credentials, "omit");
  assert.equal(headers.get("Authorization"), "Bearer upload-token");
  assert.equal(headers.has("Content-Type"), false);
});
