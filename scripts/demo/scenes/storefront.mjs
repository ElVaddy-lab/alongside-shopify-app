// Scene: product page block → cart drawer → add-on → checkout (Horizon copy).
import { connect, freshStorefront, closeDrawer, record, storefrontCookies, storefrontChrome, press, pause, glide, emptyCart, SP, STORE } from "../lib.mjs";

const THEME = "190821597405";
const { browser, ctx, page } = await connect();
await storefrontCookies(ctx);
await storefrontChrome(page);
await page.goto(`${STORE}/products/roll-top?preview_theme_id=${THEME}`, { waitUntil: "load" });
await emptyCart(page);
await freshStorefront(page);
await page.reload({ waitUntil: "load" });
await pause(2500);
await closeDrawer(page);

const rec = await record(ctx, page, `${SP}/scene-storefront`);
rec.caption("Ostiv is a demo store. Its theme copy has the Alongside block and cart embed — no theme code edited.");
await pause(4500);
await glide(page, page.locator("main").getByRole("heading", { name: "Complete your setup" }), 140);
rec.caption("Product page: add-ons at the offer price. The discount needs the Roll-Top in the cart.");
await pause(5000);
await glide(page, page.locator("h1").first(), 30);
rec.caption("The shopper adds the Roll-Top…");
await pause(1500);
await press(page.locator("button.add-to-cart-button:not(.sticky-add-to-cart__button)").first());
await pause(3500);
rec.caption("…and the cart drawer offers the add-ons, because a trigger product is in the cart.");
await pause(5000);
await press(page.getByRole("button", { name: /^Add Rain Cover/ }).last());
await pause(3500);
rec.caption("One click: Rain Cover €25.00 → €21.25 (15% off), priced by the Alongside discount function.");
await pause(6000);
await press(page.getByRole("button", { name: /check ?out/i }).last());
await page.waitForURL(/checkouts/, { timeout: 30000 });
rec.caption("Checkout: the same price and the offer's heading in the discount line.");
await pause(10000);
console.log(await rec.stop());
await browser.close().catch(() => {});
