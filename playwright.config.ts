import { defineConfig, devices } from "@playwright/test";

/**
 * Storefront E2E for the Alongside theme app extension and discount function,
 * on the dev store (ostriv.myshopify.com) in two unpublished themes:
 * a copy of the store's Horizon theme and a stock Dawn.
 *
 * The storefront is password protected. The `auth` project opens a visible
 * browser on the password page once; a person unlocks it and the session is
 * saved to e2e/.auth (git-ignored). Tests create their own carts and never pay.
 *
 * Theme IDs can be overridden: HORIZON_THEME_ID=… DAWN_THEME_ID=… npm run test:e2e
 */
export const STORE_URL = process.env.STORE_URL ?? "https://ostriv.myshopify.com";
export const AUTH_FILE = "e2e/.auth/storefront.json";

const themes = {
  horizon: process.env.HORIZON_THEME_ID ?? "190821597405",
  dawn: process.env.DAWN_THEME_ID ?? "190821794013",
};

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: STORE_URL,
    trace: "retain-on-failure",
    locale: "en-GB",
  },
  projects: [
    {
      name: "auth",
      testMatch: /auth\.setup\.ts/,
      use: { headless: false },
    },
    ...Object.entries(themes).map(([theme, id]) => ({
      name: theme,
      testMatch: /\.spec\.ts/,
      dependencies: ["auth"],
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
        storageState: AUTH_FILE,
        themeId: id,
      },
    })),
  ],
});
