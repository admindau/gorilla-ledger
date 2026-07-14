import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPrivateNoStore,
  PRIVATE_NO_STORE_CACHE_CONTROL,
} from "../lib/http/privateCache.ts";

test("private responses receive a complete no-store policy", () => {
  const headers = new Headers({
    "Cache-Control": "public, max-age=3600",
  });

  const result = applyPrivateNoStore(headers);

  assert.equal(result, headers);
  assert.equal(headers.get("Cache-Control"), PRIVATE_NO_STORE_CACHE_CONTROL);
  assert.equal(headers.get("Pragma"), "no-cache");
  assert.equal(headers.get("Expires"), "0");
});
