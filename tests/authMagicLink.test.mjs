import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loginSource = await readFile(
  new URL("../components/auth/LoginForm.tsx", import.meta.url),
  "utf8"
);
const registerSource = await readFile(
  new URL("../app/auth/register/RegisterForm.tsx", import.meta.url),
  "utf8"
);
const routeSource = await readFile(
  new URL("../app/auth/send-magic-link/route.ts", import.meta.url),
  "utf8"
);
const emailSource = await readFile(
  new URL("../lib/email.ts", import.meta.url),
  "utf8"
);
const topNavSource = await readFile(
  new URL("../components/AppTopNav.tsx", import.meta.url),
  "utf8"
);
const logoutRouteSource = await readFile(
  new URL("../app/auth/logout/route.ts", import.meta.url),
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
  assert.match(routeSource, /properties\?\.hashed_token/);
  assert.match(routeSource, /buildEmailConfirmationUrl/);
  assert.match(routeSource, /const deliveryMode.*exists \? "login" : "signup"/);
  assert.match(routeSource, /use only the newest link/i);
  assert.match(routeSource, /Retry-After/);
  assert.doesNotMatch(routeSource, /magicLinkEmail\(actionLink/);
});

test("transactional email uses a monitored sender identity", () => {
  assert.match(emailSource, /from: `\$\{PRODUCT_NAME\} <\$\{SUPPORT_EMAIL\}>`/);
  assert.match(emailSource, /replyTo: SUPPORT_EMAIL/);
  assert.doesNotMatch(emailSource, /no-reply@/);
});

test("logout clears both server and browser sessions", () => {
  assert.match(topNavSource, /fetch\("\/auth\/logout"/);
  assert.match(topNavSource, /signOut\(\{ scope: "local" \}\)/);
  assert.match(topNavSource, /location\.replace\("\/auth\/login"\)/);
  assert.match(logoutRouteSource, /signOut\(\{ scope: "local" \}\)/);
  assert.match(logoutRouteSource, /NEXT_PUBLIC_SITE_URL/);
});
