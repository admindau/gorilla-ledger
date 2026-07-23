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

test("sign-in uses a magic link and never creates an unknown user", () => {
  assert.match(loginSource, /signInWithOtp/);
  assert.match(loginSource, /shouldCreateUser:\s*false/);
  assert.doesNotMatch(loginSource, /signInWithPassword|type="password"/);
});

test("sign-up uses a magic link and can create a new user", () => {
  assert.match(registerSource, /signInWithOtp/);
  assert.match(registerSource, /shouldCreateUser:\s*true/);
  assert.doesNotMatch(registerSource, /signUp\(|type="password"/);
});
