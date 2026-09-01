import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const storageState = process.env.E2E_AUTH_STORAGE;
const routes = ["/dashboard", "/wallets", "/categories", "/transactions", "/budgets", "/recurring", "/exports", "/settings/family", "/settings/security"];

test.describe("authenticated route accessibility", () => {
  test.skip(!storageState, "Set E2E_AUTH_STORAGE to a dedicated test-account Playwright state file.");
  test.use({ storageState: storageState || { cookies: [], origins: [] } });

  for (const route of routes) {
    test(`${route} has no serious accessibility violations`, async ({ page }) => {
      await page.goto(route);
      await expect(page.locator("main")).toBeVisible();
      const results = await new AxeBuilder({ page }).analyze();
      const blocking = results.violations.filter((violation) => ["critical", "serious"].includes(violation.impact ?? ""));
      expect(blocking, JSON.stringify(blocking, null, 2)).toEqual([]);
    });
  }
});
