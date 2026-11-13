import { AxeBuilder } from "@axe-core/playwright";

import { CART_POLL, expect, test } from "./fixtures";

/**
 * Offer used by every test, created in the Alongside admin on the dev store:
 * "Roll-Top add-ons" — trigger Roll-Top, add-ons Rain Cover (€25.00) and
 * Key Leash (€19.00), 15 % off, shown on the product page and in the cart.
 */
const OFFER_HEADING = "Complete your setup";
const OFFER_HANDLE = "roll-top-add-ons";
const RAIN_COVER = { title: "Rain Cover", full: 2500, offer: 2125 };
const KEY_LEASH = { title: "Key Leash", full: 1900, offer: 1615 };

const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

test.describe("product page block", () => {
  test("shows the add-ons at the offer price and says the discount needs the trigger", async ({ page, shop }) => {
    await shop.goto("/products/roll-top");
    const offer = page.getByRole("region", { name: OFFER_HEADING });
    await expect(offer).toBeVisible();

    await expect(offer.getByRole("link", { name: "Rain Cover" })).toBeVisible();
    await expect(offer).toContainText("€25,00");
    await expect(offer).toContainText("€21,25");
    await expect(offer).toContainText("€19,00");
    await expect(offer).toContainText("€16,15");
    await expect(offer.getByText("15% off with Roll-Top").first()).toBeVisible();
    await expect(offer.getByRole("button", { name: "Add Rain Cover, 15% off with Roll-Top" })).toBeVisible();
  });

  test("is not rendered on a product that triggers no offer", async ({ page, shop }) => {
    await shop.goto("/products/bifold-wallet");
    await expect(page.locator("[data-alongside-offer]")).toHaveCount(0);
  });

  test("adds the add-on with the trigger in the cart: offer price, offer tag on the line", async ({ page, shop }) => {
    await shop.goto("/products/roll-top");
    await shop.addToCart("roll-top");

    const offer = page.getByRole("region", { name: OFFER_HEADING });
    await offer.getByRole("button", { name: /^Add Rain Cover/ }).click();
    await expect(offer.getByRole("status")).toHaveText("Added to cart.");

    await expect.poll(async () => (await shop.line(RAIN_COVER.title))?.final_line_price, CART_POLL).toBe(RAIN_COVER.offer);
    const line = await shop.line(RAIN_COVER.title);
    expect(line?.properties).toMatchObject({ _alongside_offer: OFFER_HANDLE });
    expect(line?.discounts.map((d) => d.title)).toContain("Complete your setup: 15% off");
  });

  test("without the trigger in the cart the add-on stays at full price", async ({ page, shop }) => {
    await shop.goto("/products/roll-top");
    const offer = page.getByRole("region", { name: OFFER_HEADING });
    await offer.getByRole("button", { name: /^Add Rain Cover/ }).click();

    await expect.poll(async () => (await shop.line(RAIN_COVER.title))?.final_line_price, CART_POLL).toBe(RAIN_COVER.full);
  });

  test("works without JavaScript (plain form post to /cart/add)", async ({ browser, themeId }) => {
    const context = await browser.newContext({ javaScriptEnabled: false, storageState: "e2e/.auth/storefront.json" });
    const page = await context.newPage();
    await page.goto(`/products/roll-top?preview_theme_id=${themeId}`);
    await page.getByRole("region", { name: OFFER_HEADING }).getByRole("button", { name: /^Add Key Leash/ }).click();
    await expect(page).toHaveURL(/\/cart/);
    const cart = await (await context.request.get("/cart.js")).json();
    expect(cart.items.map((i: { product_title: string }) => i.product_title)).toContain(KEY_LEASH.title);
    await context.close();
  });

  test("has no axe violations in the offer", async ({ page, shop }) => {
    await shop.goto("/products/roll-top");
    await expect(page.locator("[data-alongside-offer]")).toBeVisible();
    const results = await new AxeBuilder({ page }).include("[data-alongside-offer]").withTags(WCAG).analyze();
    expect(results.violations).toEqual([]);
  });
});

// One cart per theme for the whole cart flow: the storefront rate-limits
// /cart/add (HTTP 429) when tests keep creating carts.
test("cart embed: cart page, drawer add with focus kept, checkout total", async ({ page, shop }) => {
  await shop.goto("/products/bifold-wallet");
  await shop.addToCart("roll-top");
  await shop.addToCart("rain-cover");

  await test.step("cart page: offer after the cart form, only add-ons not in the cart, axe clean", async () => {
    await shop.goto("/cart");
    const offer = page.locator("[data-alongside-cart]:visible").getByRole("region", { name: OFFER_HEADING });
    await expect(offer).toBeVisible();
    await expect(offer.getByRole("link", { name: "Key Leash" })).toBeVisible();
    await expect(offer.getByRole("link", { name: "Rain Cover" })).toHaveCount(0);
    await expect(offer).toContainText("€16,15");
    const results = await new AxeBuilder({ page }).include("[data-alongside-cart]:not([hidden])").withTags(WCAG).analyze();
    expect(results.violations).toEqual([]);
  });

  await test.step("drawer: add Key Leash, offer gone, focus stays in the cart form", async () => {
    await shop.goto("/products/bifold-wallet");
    await shop.openCart();
    const offer = page.locator("[data-alongside-cart]:visible").getByRole("region", { name: OFFER_HEADING });
    await offer.getByRole("button", { name: /^Add Key Leash/ }).click();
    await expect
      .poll(async () => (await shop.line(KEY_LEASH.title))?.final_line_price, CART_POLL)
      .toBe(KEY_LEASH.offer);
    await expect(page.locator("[data-alongside-cart]:visible")).toHaveCount(0);
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.matches("form, form *") ?? false), { timeout: 5_000 })
      .toBe(true);
    await expect(page.getByRole("status").filter({ hasText: "Added to cart." })).toHaveCount(1);
  });

  await test.step("checkout: both add-ons discounted, offer message shown", async () => {
    await page.goto("/checkout");
    await expect(page).toHaveURL(/checkouts?\//);
    const body = page.locator("body");
    await expect(body).toContainText(/complete your setup: 15% off/i);
    await expect(body).toContainText("€21.25");
    await expect(body).toContainText("€16.15");
  });
});
