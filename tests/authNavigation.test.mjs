import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_APP_DESTINATION,
  shouldRedirectAuthenticatedHome,
} from "../lib/auth/navigation.ts";

test("authenticated visitors are routed from the public home to the app", () => {
  assert.equal(shouldRedirectAuthenticatedHome("/", true), true);
  assert.equal(DEFAULT_APP_DESTINATION, "/dashboard");
});

test("anonymous visitors can still view the public home", () => {
  assert.equal(shouldRedirectAuthenticatedHome("/", false), false);
});

test("authenticated visitors can still view company and legal pages", () => {
  for (const pathname of ["/about", "/contact", "/privacy", "/terms", "/security"]) {
    assert.equal(shouldRedirectAuthenticatedHome(pathname, true), false);
  }
});
