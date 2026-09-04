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
const sessionRouteSource = await readFile(
  new URL("../app/auth/confirm/session/route.ts", import.meta.url),
  "utf8"
);

test("sign-in uses an emailed code and never creates an unknown user", () => {
  assert.match(loginSource, /\/auth\/send-magic-link/);
  assert.match(loginSource, /mode:\s*"login"/);
  assert.doesNotMatch(loginSource, /signInWithPassword|type="password"/);
});

test("sign-up uses an emailed code and can create a new user", () => {
  assert.match(registerSource, /\/auth\/send-magic-link/);
  assert.match(registerSource, /mode:\s*"signup"/);
  assert.doesNotMatch(registerSource, /signUp\(|type="password"/);
});

test("code delivery keeps shared Roots templates untouched", () => {
  assert.match(routeSource, /auth\.admin\.generateLink/);
  assert.match(routeSource, /Your \$\{PRODUCT_NAME\} sign-in code/);
  assert.match(routeSource, /sendEmail/);
  assert.match(routeSource, /mode === "login" && !exists/);
  assert.match(routeSource, /properties\?\.email_otp/);
  assert.match(routeSource, /Delivery accepted/);
  assert.match(routeSource, /deliveryId/);
  assert.match(routeSource, /Request reference|reference/);
  assert.match(routeSource, /const deliveryMode.*exists \? "login" : "signup"/);
  assert.match(routeSource, /use only the newest code/i);
  assert.match(routeSource, /Retry-After/);
  assert.doesNotMatch(routeSource, /href=/);
});

test("cross-device sign-in can verify the emailed one-time code", () => {
  assert.match(loginSource, /autoComplete="one-time-code"/);
  assert.match(loginSource, /Already have a code\?/);
  assert.match(loginSource, /Enter the email address that received the code/);
  assert.match(loginSource, /Continue with code/);
  assert.match(registerSource, /Already have an account code\?/);
  assert.match(sessionRouteSource, /hasEmailOtp/);
  assert.match(sessionRouteSource, /verifyOtp\(\{ email: email\.trim\(\)\.toLowerCase\(\), token, type \}\)/);
});

test("code-only emails explain exactly where the code belongs", () => {
  assert.match(routeSource, /select Sign in/);
  assert.match(routeSource, /type the code under Already have a code/);
  assert.match(routeSource, /select Create account/);
  assert.doesNotMatch(routeSource, /href=/);
});

test("transactional email uses a monitored sender identity", () => {
  assert.match(emailSource, /from: `\$\{PRODUCT_NAME\} <\$\{SUPPORT_EMAIL\}>`/);
  assert.match(emailSource, /replyTo: SUPPORT_EMAIL/);
  assert.match(emailSource, /idempotencyKey: deliveryKey/);
  assert.match(emailSource, /attempt <= 2/);
  assert.doesNotMatch(emailSource, /no-reply@/);
});

test("logout clears both server and browser sessions", () => {
  assert.match(topNavSource, /fetch\("\/auth\/logout"/);
  assert.match(topNavSource, /signOut\(\{ scope: "local" \}\)/);
  assert.match(topNavSource, /location\.replace\("\/auth\/login"\)/);
  assert.match(logoutRouteSource, /signOut\(\{ scope: "local" \}\)/);
  assert.match(logoutRouteSource, /NEXT_PUBLIC_SITE_URL/);
});

test("desktop navigation keeps the active destination visible", () => {
  assert.match(topNavSource, /desktopNavRef/);
  assert.match(topNavSource, /activeDesktopLinkRef/);
  assert.match(topNavSource, /nav\.scrollTo/);
  assert.match(topNavSource, /linkRight > visibleRight/);
});

test("admin navigation is supplied by the shared server-side access policy", () => {
  assert.match(topNavSource, /showPlatformAnalytics/);
  assert.doesNotMatch(topNavSource, /admindau@proton\.me/);
});
