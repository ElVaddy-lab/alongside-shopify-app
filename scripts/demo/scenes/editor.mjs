// Scene: theme editor — the app block in the product template and the cart app embed. Nothing is saved.
import { connect, record, press, pause, SP, ADMIN } from "../lib.mjs";

const { browser, ctx, page } = await connect();
await page.goto(`${ADMIN}/themes/190821597405/editor?previewPath=%2Fproducts%2Froll-top`, { waitUntil: "domcontentloaded" });
const ed = page.frameLocator('iframe[src*="online-store-web"][src*="editor"]');
const expand = ed.locator('button[aria-label="Open sub items menu"]').nth(2);
await expand.waitFor({ timeout: 60000 });
await pause(6000);

const rec = await record(ctx, page, `${SP}/scene-editor`);
rec.caption("Merchants place Alongside in the theme editor — no theme code to edit.");
await pause(3500);
await press(expand);
await pause(1500);
await press(ed.getByRole("button", { name: "Add-on offers", exact: true }));
rec.caption("The \"Add-on offers\" app block sits in the product template…");
await pause(6000);
await press(ed.getByRole("button", { name: "Open app embeds panel" }));
rec.caption("…and the cart offers are an app embed, switched on here. Removing both leaves the theme as it was.");
await pause(6500);
console.log(await rec.stop());
await browser.close().catch(() => {});
