import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loginSource = await readFile(
  new URL("../components/auth/LoginForm.tsx", import.meta.url),
  "utf8"
);
const registerSource = await readFile(
  new URL("../app/auth/register/page.tsx", import.meta.url),
  "utf8"
);
const routeSource = await readFile(
  new URL("../app/auth/send-magic-link/route.ts", import.meta.url),
  "utf8"
);

test("sign-in uses a magic link and never creates an unknown user", () => {
  assert.match(loginSource, /\/auth\/send-magic-link/);
  assert.match(loginSource, /mode:\s*"login"/);
  assert.doesNotMatch(loginSource, /signInWithPassword|type="password"/);
});

test("sign-up uses a magic link and can create a new user", () => {
  assert.match(registerSource, /\/auth\/send-magic-link/);
  assert.match(registerSource, /mode:\s*"signup"/);
  assert.doesNotMatch(registerSource, /signUp\(|type="password"/);
});

test("magic-link delivery keeps shared Roots templates untouched", () => {
  assert.match(routeSource, /auth\.admin\.generateLink/);
  assert.match(routeSource, /Your \$\{PRODUCT_NAME\} sign-in link/);
  assert.match(routeSource, /sendEmail/);
  assert.match(routeSource, /mode === "login" && !exists/);
});
