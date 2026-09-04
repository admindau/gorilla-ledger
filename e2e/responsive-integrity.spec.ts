import { expect, test } from "@playwright/test";

const publicRoutes = ["/", "/about", "/security", "/contact", "/privacy", "/terms", "/auth/login", "/auth/register", "/auth/reset-password"];
const compactViewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 1024, height: 768 },
];

for (const viewport of compactViewports) {
  test.describe(`${viewport.width}px responsive integrity`, () => {
    test.use({ viewport });
    for (const route of publicRoutes) {
      test(`${route} has no document-level horizontal overflow`, async ({ page }) => {
        await page.goto(route);
        await expect(page.locator("main")).toBeVisible();
        const dimensions = await page.evaluate(() => ({
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
        }));
        expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
      });
    }
  });
}

const storageState = process.env.E2E_AUTH_STORAGE;
test.describe("authenticated responsive integrity", () => {
  test.skip(!storageState, "Set E2E_AUTH_STORAGE to a dedicated test-account Playwright state file.");
  test.use({ storageState: storageState || { cookies: [], origins: [] }, viewport: { width: 320, height: 568 } });

  for (const route of ["/dashboard", "/categories", "/transactions", "/recurring", "/settings/family"]) {
    test(`${route} fits the narrow viewport`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("main h1")).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
    });
  }

  test("dashboard monetary values are not ellipsized", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /financial outlook/i })).toBeVisible();
    const clippedMoney = await page.evaluate(() => [...document.querySelectorAll(".tabular-nums")].filter((element) => {
      const style = getComputedStyle(element);
      return style.textOverflow === "ellipsis" || element.scrollWidth > element.clientWidth + 1;
    }).length);
    expect(clippedMoney).toBe(0);
  });
});
