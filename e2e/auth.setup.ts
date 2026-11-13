import fs from "node:fs";
import { expect, test as setup } from "@playwright/test";

import { AUTH_FILE } from "../playwright.config";

/**
 * Reuses a saved storefront session when it still opens the shop; otherwise
 * opens the password page in a visible window and waits for a person to
 * unlock the storefront (the password is never stored in this repository).
 */
setup("storefront session", async ({ page }) => {
  setup.setTimeout(5 * 60_000);

  if (fs.existsSync(AUTH_FILE)) {
    const state = JSON.parse(fs.readFileSync(AUTH_FILE, "utf8"));
    await page.context().addCookies(state.cookies ?? []);
  }

  await page.goto("/");
  if (new URL(page.url()).pathname.startsWith("/password")) {
    console.log("\n>>> Unlock the storefront in the opened browser window (password page). Waiting up to 5 minutes…\n");
    await page.waitForURL((url) => !url.pathname.startsWith("/password"), { timeout: 5 * 60_000 });
  }
  await expect(page).not.toHaveURL(/\/password/);
  await page.context().storageState({ path: AUTH_FILE });
});
