// Scene: the same offer on stock Dawn — product page block and the cart page.
import { connect, freshStorefront, closeDrawer, record, storefrontCookies, storefrontChrome, pause, glide, emptyCart, SP, STORE } from "../lib.mjs";

const THEME = "190821794013";
const { browser, ctx, page } = await connect();
await storefrontCookies(ctx);
await storefrontChrome(page);
await page.goto(`${STORE}/products/roll-top?preview_theme_id=${THEME}`, { waitUntil: "load" });
await emptyCart(page);
await freshStorefront(page);
await page.reload({ waitUntil: "load" });
await pause(2500);
await closeDrawer(page);

const rec = await record(ctx, page, `${SP}/scene-dawn`);
rec.caption("The same offer on Shopify's stock Dawn theme — same block, no theme-specific code.");
await pause(2500);
await glide(page, page.locator("main").getByRole("heading", { name: "Complete your setup" }), 330);
await pause(4500);
await page.evaluate(() => fetch("/cart/add.js", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items: [{ id: 50320008872157, quantity: 1 }] }) }));
await page.goto(`${STORE}/cart?preview_theme_id=${THEME}`, { waitUntil: "load" });
await pause(1500);
rec.caption("Dawn's cart page: the cart embed finds the cart form by itself; other themes set a CSS selector.");
await glide(page, page.getByRole("heading", { name: "Complete your setup" }).first(), 260);
await pause(6000);
console.log(await rec.stop());
await emptyCart(page);
await browser.close().catch(() => {});
