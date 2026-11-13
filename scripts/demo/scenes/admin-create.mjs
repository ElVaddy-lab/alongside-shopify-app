// Scene: create an offer in the admin (resource picker, fixed amount), see it in Discounts.
import { connect, storefrontChrome, record, app, hideSidekick, press, pause, SP, ADMIN } from "../lib.mjs";

const { browser, ctx, page } = await connect();
await storefrontChrome(page);
await page.goto(`${ADMIN}/apps/alongside`, { waitUntil: "domcontentloaded" });
const a = app(page);
await a.getByRole("link", { name: "Roll-Top add-ons" }).waitFor({ timeout: 30000 });
await hideSidekick(page);
await pause(1000);

const rec = await record(ctx, page, `${SP}/scene-admin-create`);
rec.caption("Creating a new offer: Bifold Wallet → Key Leash, €3 off.");
await pause(2500);
await press(page.getByRole("button", { name: "Create offer" }).first());
await a.getByLabel("Internal name").waitFor({ timeout: 30000 });
await hideSidekick(page);
await pause(1200);
await a.getByLabel("Internal name").pressSequentially("Wallet add-ons", { delay: 70 });
await pause(400);
await a.getByLabel("Heading shown to customers").pressSequentially("Pairs well with", { delay: 70 });
await pause(800);

rec.caption("Products come from Shopify's own resource picker (App Bridge).");
await press(a.getByRole("button", { name: "Choose trigger products" }));
const dialog = page.getByRole("dialog");
await dialog.getByPlaceholder("Search products").waitFor();
await pause(800);
await dialog.getByPlaceholder("Search products").pressSequentially("wallet", { delay: 90 });
await pause(1800);
await press(dialog.locator('[aria-label="Select: Bifold Wallet"]'), { hold: 400 });
await pause(600);
await press(dialog.getByRole("button", { name: "Select" }), { hold: 400 });
await pause(1500);

await press(a.getByRole("button", { name: "Choose add-ons" }));
await dialog.getByPlaceholder("Search products").waitFor();
await pause(800);
await dialog.getByPlaceholder("Search products").pressSequentially("key leash", { delay: 90 });
await pause(1800);
await press(dialog.locator('[aria-label="Select: Key Leash"]'), { hold: 400 });
await pause(600);
await press(dialog.getByRole("button", { name: "Select" }), { hold: 400 });
await pause(1500);

rec.caption("Percentage or a fixed amount off each add-on, in the store currency.");
const type = a.getByLabel("Discount type");
await type.scrollIntoViewIfNeeded();
await pause(600);
await type.selectOption("fixed_amount");
await pause(900);
await a.getByLabel("Discount value").pressSequentially("3", { delay: 120 });
await pause(1200);

rec.caption("Saving writes a metaobject for the storefront and an automatic discount for checkout.");
await press(a.getByRole("button", { name: "Save offer" }));
await a.getByRole("link", { name: "Wallet add-ons" }).waitFor({ timeout: 30000 });
await pause(3500);

rec.caption("The discount is a regular Shopify discount, powered by the Alongside function.");
await page.goto(`${ADMIN}/discounts`, { waitUntil: "domcontentloaded" });
await page.getByText("Alongside · Wallet add-ons").first().waitFor({ timeout: 30000 });
await hideSidekick(page);
await pause(5000);
console.log(await rec.stop());
await browser.close().catch(() => {});
