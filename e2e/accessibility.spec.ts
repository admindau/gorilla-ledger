import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const publicRoutes = [
  "/",
  "/auth/login",
  "/auth/register",
  "/auth/reset-password",
  "/about",
  "/contact",
  "/security",
  "/privacy",
  "/terms",
];

for (const route of publicRoutes) {
  test(`${route} has a stable landmark and no serious axe violations`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    await expect(page.locator("body")).not.toHaveCSS("overflow-x", "scroll");
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""));
    expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
  });
}

test("login is keyboard operable and reveals the code field", async ({ page }, testInfo) => {
  await page.goto("/auth/login");
  if (!testInfo.project.name.includes("mobile")) {
    await page.locator("#login-email").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /email me a sign-in code/i })).toBeFocused();
  }
  await expect(page.locator("#login-code")).toBeVisible();
});

test("registration keeps both account steps keyboard accessible", async ({ page }, testInfo) => {
  await page.goto("/auth/register");
  await expect(page.locator("#register-email")).toBeVisible();
  await expect(page.locator("#register-code")).toBeVisible();
  if (!testInfo.project.name.includes("mobile")) {
    await page.locator("#register-email").focus();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: /email me an account code/i })).toBeFocused();
  }
});
