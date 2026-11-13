// Scene: the new offer on the storefront → turn off → gone → delete. Leaves the store as before.
import { connect, freshStorefront, closeDrawer, record, app, hideSidekick, storefrontCookies, storefrontChrome, press, pause, glide, SP, ADMIN, STORE } from "../lib.mjs";

const THEME = "190821597405";
const WALLET = `${STORE}/products/bifold-wallet?preview_theme_id=${THEME}`;
const { browser, ctx, page } = await connect();
await storefrontCookies(ctx);
await storefrontChrome(page);
// The storefront picks up a new metaobject entry after a short cache delay.
await page.goto(WALLET, { waitUntil: "load" });
await freshStorefront(page);
for (let i = 0; i < 10; i++) {
  await page.goto(WALLET, { waitUntil: "load" });
  if (await page.locator("main").getByRole("heading", { name: "Pairs well with" }).count()) break;
  await pause(3000);
}
await pause(1500);
await closeDrawer(page);

const rec = await record(ctx, page, `${SP}/scene-admin-off`);
const heading = page.locator("main").getByRole("heading", { name: "Pairs well with" });
await heading.waitFor({ timeout: 20000 });
rec.caption("Seconds later the wallet page shows the new offer: Key Leash €19.00 → €16.00.");
await pause(1000);
await glide(page, heading, 160);
await pause(6000);
rec.clear();

await page.goto(`${ADMIN}/apps/alongside`, { waitUntil: "domcontentloaded" });
const a = app(page);
await a.getByRole("link", { name: "Wallet add-ons" }).waitFor({ timeout: 30000 });
await hideSidekick(page);
rec.caption("Turn off: the discount is deactivated and the offer is hidden from the storefront.");
await pause(1500);
await press(a.getByRole("button", { name: "Turn off Wallet add-ons" }));
await pause(4000);
rec.clear();

await page.goto(WALLET, { waitUntil: "load" });
await pause(1500);
await closeDrawer(page);
rec.caption("The wallet page without the offer — nothing to remove from the theme.");
await glide(page, page.locator("button.add-to-cart-button:not(.sticky-add-to-cart__button)").first(), 220);
await pause(5000);
rec.clear();

await page.goto(`${ADMIN}/apps/alongside`, { waitUntil: "domcontentloaded" });
await a.getByRole("link", { name: "Wallet add-ons" }).waitFor({ timeout: 30000 });
await hideSidekick(page);
rec.caption("Delete asks first, then removes the offer and its discount.");
await pause(1500);
await press(a.getByRole("button", { name: "Delete Wallet add-ons" }));
await pause(2000);
await press(a.getByRole("button", { name: "Delete offer" }));
await pause(4000);
console.log(await rec.stop());
await browser.close().catch(() => {});
