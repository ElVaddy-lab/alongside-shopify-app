// Scene: the offer list and the existing offer's form.
import { connect, storefrontChrome, record, app, hideSidekick, press, pause, reveal, SP, ADMIN } from "../lib.mjs";

const { browser, ctx, page } = await connect();
await storefrontChrome(page);
await page.goto(`${ADMIN}/apps/alongside`, { waitUntil: "domcontentloaded" });
const a = app(page);
await a.getByRole("link", { name: "Roll-Top add-ons" }).waitFor({ timeout: 30000 });
await hideSidekick(page);
await pause(1000);

const rec = await record(ctx, page, `${SP}/scene-admin-tour`);
rec.caption("The Alongside admin, embedded in Shopify: one row per offer — trigger, add-ons, discount, status.");
await pause(5500);
await press(a.getByRole("link", { name: "Roll-Top add-ons" }));
await a.getByLabel("Internal name").waitFor({ timeout: 30000 });
await hideSidekick(page);
rec.caption("An internal name for the team and the heading customers see.");
await pause(4500);
await reveal(a.locator('s-section[heading="Products"]'));
rec.caption("Trigger products and up to three add-ons.");
await pause(4500);
await reveal(a.locator('s-section[heading="Discount"]'));
rec.caption("A percentage or fixed amount, and where to show the offer: cart, product page or both.");
await pause(5500);
console.log(await rec.stop());
await browser.close().catch(() => {});
