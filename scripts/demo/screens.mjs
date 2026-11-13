// Screenshots for the portfolio case (case/, kept out of git): admin, theme
// editor, storefront on Horizon and Dawn, checkout, and two mobile views.
// Uses the recording browser (see record-all.sh). Nothing is saved in the admin.
//   node scripts/demo/screens.mjs [outDir=case]
import fs from "node:fs";
import {
  connect, app, storefrontChrome, freshStorefront, emptyCart, closeDrawer, glide, reveal, pause, ADMIN, STORE,
} from "./lib.mjs";

const OUT = process.argv[2] ?? "case";
fs.mkdirSync(OUT, { recursive: true });
const HORIZON = "190821597405";
const DAWN = "190821794013";
const ROLL_TOP_VARIANT = 50320008872157;

const { browser, cdp, page } = await connect({ width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await storefrontChrome(page);
const shot = async (name) => {
  await pause(600);
  await page.screenshot({ path: `${OUT}/${name}.png` });
  console.log(name);
};
const a = app(page);

// Admin
await page.goto(`${ADMIN}/apps/alongside`, { waitUntil: "domcontentloaded" });
await a.getByRole("link", { name: "Roll-Top add-ons" }).waitFor({ timeout: 30000 });
await pause(1500);
await shot("admin-offers");
await a.getByRole("link", { name: "Roll-Top add-ons" }).click();
await a.getByLabel("Internal name").waitFor({ timeout: 30000 });
await pause(2500);
await shot("admin-offer-form");
await reveal(a.locator('s-section[heading="Discount"]'));
await shot("admin-offer-discount");
await page.goto(`${ADMIN}/apps/alongside/app/offers/new`, { waitUntil: "domcontentloaded" });
await a.getByRole("button", { name: "Choose add-ons" }).click({ timeout: 30000 });
await page.getByRole("dialog").getByPlaceholder("Search products").waitFor();
await pause(2500);
await shot("admin-picker");
await page.keyboard.press("Escape");
await page.goto(`${ADMIN}/discounts`, { waitUntil: "domcontentloaded" });
await page.getByText("Alongside · Roll-Top add-ons").first().waitFor({ timeout: 30000 });
await shot("admin-discounts");

// Theme editor (nothing saved)
// The editor opens with the app block selected (its ID in this theme copy's product template).
const BLOCK = "template--28525683376349__main__product-details__alongside_product_offers_jfaprR";
await page.goto(
  `${ADMIN}/themes/${HORIZON}/editor?previewPath=%2Fproducts%2Froll-top&block=${BLOCK}&section=template--28525683376349__main`,
  { waitUntil: "domcontentloaded" },
);
const ed = page.frameLocator('iframe[src*="online-store-web"][src*="editor"]');
await ed.getByRole("button", { name: "Open app embeds panel" }).waitFor({ timeout: 60000 });
await pause(9000);
for (const f of page.frames().filter((x) => x.url().includes("ostriv.myshopify.com"))) {
  const h = f.locator("main").getByRole("heading", { name: "Complete your setup" });
  if (await h.count().catch(() => 0)) {
    await glide(page, h, 260);
    break;
  }
}
await shot("theme-editor-block");
await ed.getByRole("button", { name: "Open app embeds panel" }).click();
await pause(2000);
await shot("theme-editor-embed");

// Storefront, Horizon copy
const product = (theme) => `${STORE}/products/roll-top?preview_theme_id=${theme}`;
await page.goto(product(HORIZON), { waitUntil: "load" });
await emptyCart(page);
await freshStorefront(page);
await page.reload({ waitUntil: "load" });
await pause(2000);
await closeDrawer(page);
await glide(page, page.locator("main").getByRole("heading", { name: "Complete your setup" }), 150);
await shot("product-block");
await glide(page, page.locator("h1").first(), 30);
await page.locator("button.add-to-cart-button:not(.sticky-add-to-cart__button)").first().click();
await page.getByRole("button", { name: /^Add Rain Cover/ }).last().waitFor({ timeout: 20000 });
await pause(2000);
await shot("cart-drawer-offer");
await page.getByRole("button", { name: /^Add Rain Cover/ }).last().click();
await pause(4000);
await shot("cart-drawer-added");
await page.getByRole("button", { name: /check ?out/i }).last().click();
await page.waitForURL(/checkouts/, { timeout: 30000 });
await pause(6000);
await shot("checkout");

// Storefront, Dawn
await page.goto(product(DAWN), { waitUntil: "load" });
await emptyCart(page);
await freshStorefront(page);
await page.reload({ waitUntil: "load" });
await pause(2000);
await glide(page, page.locator("main").getByRole("heading", { name: "Complete your setup" }), 330);
await shot("dawn-product-block");
await page.evaluate((id) => fetch("/cart/add.js", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id, quantity: 1 }] }) }), ROLL_TOP_VARIANT);
await page.goto(`${STORE}/cart?preview_theme_id=${DAWN}`, { waitUntil: "load" });
await pause(2000);
await glide(page, page.getByRole("heading", { name: "Complete your setup" }).first(), 330);
await shot("dawn-cart");

// Mobile, Horizon copy
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await page.goto(product(HORIZON), { waitUntil: "load" });
await emptyCart(page);
await freshStorefront(page);
await page.reload({ waitUntil: "load" });
await pause(2500);
await closeDrawer(page);
await glide(page, page.locator("main").getByRole("heading", { name: "Complete your setup" }), 90);
await shot("product-block-mobile");
await page.evaluate((id) => fetch("/cart/add.js", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id, quantity: 1 }] }) }), ROLL_TOP_VARIANT);
await page.goto(`${STORE}/cart?preview_theme_id=${HORIZON}`, { waitUntil: "load" });
await pause(2500);
await closeDrawer(page);
await glide(page, page.getByRole("heading", { name: "Complete your setup" }).first(), 90);
await shot("cart-page-mobile");

await emptyCart(page);
await freshStorefront(page);
await browser.close().catch(() => {});
