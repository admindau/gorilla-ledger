import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_APP_DESTINATION,
  isProtectedAppPath,
  requiresMfaStepUp,
  sanitizeAppDestination,
  sanitizeConfirmationDestination,
  shouldRedirectAuthenticatedHome,
  shouldRedirectAuthenticatedLogin,
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

test("authenticated visitors do not see the login form again", () => {
  assert.equal(shouldRedirectAuthenticatedLogin("/auth/login", true), true);
  assert.equal(shouldRedirectAuthenticatedLogin("/auth/login", false), false);
});

test("return destinations remain inside the application", () => {
  assert.equal(sanitizeAppDestination("/transactions?month=2026-07"), "/transactions?month=2026-07");
  assert.equal(sanitizeAppDestination("https://example.com"), "/dashboard");
  assert.equal(sanitizeAppDestination("//example.com/path"), "/dashboard");
  assert.equal(sanitizeAppDestination("/auth/login"), "/dashboard");
  assert.equal(sanitizeAppDestination("/"), "/dashboard");
});

test("confirmation destinations are limited to protected app and recovery routes", () => {
  assert.equal(sanitizeConfirmationDestination("/dashboard"), "/dashboard");
  assert.equal(
    sanitizeConfirmationDestination("/auth/update-password"),
    "/auth/update-password"
  );
  assert.equal(sanitizeConfirmationDestination("https://example.com"), "/dashboard");
  assert.equal(sanitizeConfirmationDestination("//example.com/path"), "/dashboard");
  assert.equal(sanitizeConfirmationDestination("/auth/logout"), "/dashboard");
  assert.equal(sanitizeConfirmationDestination("/about"), "/dashboard");
});

test("accounts expecting aal2 must complete MFA before app access", () => {
  assert.equal(requiresMfaStepUp("aal1", "aal2"), true);
  assert.equal(requiresMfaStepUp("aal2", "aal2"), false);
  assert.equal(requiresMfaStepUp("aal1", "aal1"), false);
});

test("private app routes fail closed while public and auth routes remain public", () => {
  for (const pathname of [
    "/dashboard",
    "/transactions/123",
    "/settings/security",
    "/mfa",
  ]) {
    assert.equal(isProtectedAppPath(pathname), true);
  }

  for (const pathname of ["/", "/about", "/privacy", "/auth/login", "/auth/mfa"]) {
    assert.equal(isProtectedAppPath(pathname), false);
  }
});
