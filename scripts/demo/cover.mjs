// One cover image (case/cover.png, 1600×1000) for portfolio sites that take a single picture.
import fs from "node:fs";
import { chromium } from "playwright-core";

const img = (f) => `data:image/png;base64,${fs.readFileSync(`case/${f}`).toString("base64")}`;
const tile = (f, pos, label, size = "auto 125%") =>
  `<figure><div style="background-image:url(${img(f)});background-position:${pos};background-size:${size}"></div><figcaption>${label}</figcaption></figure>`;

const html = `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 800px; background: #15171a; color: #f2f0eb; font-family: "Segoe UI", system-ui, sans-serif;
         display: grid; grid-template-columns: 360px 1fr; gap: 28px; padding: 40px; }
  .text { display: flex; flex-direction: column; justify-content: center; gap: 18px; }
  .kicker { color: #f08c4a; font-size: 15px; letter-spacing: .14em; text-transform: uppercase; font-weight: 600; }
  h1 { font-size: 44px; line-height: 1.08; }
  p { font-size: 18px; line-height: 1.45; color: #d4d1ca; }
  .note { font-size: 14px; color: #9b978f; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 16px; }
  figure { display: flex; flex-direction: column; gap: 8px; min-height: 0; }
  figure div { flex: 1; border-radius: 10px; background-repeat: no-repeat; background-color: #fff; border: 1px solid #3a3d42; }
  figcaption { font-size: 14px; color: #b9b5ad; }
</style><body>
  <div class="text">
    <div class="kicker">Custom Shopify app · demo</div>
    <h1>Alongside: add&#8209;on offers with a Shopify Function</h1>
    <p>Embedded admin, a theme app extension for the product page and cart, and a Discount Function that prices the add-on through checkout.</p>
    <p class="note">Demo store Ostiv: fictional products, orders not fulfilled.</p>
  </div>
  <div class="grid">
    ${tile("admin-offer-discount.png", "48% 0%", "Admin: offer form (Polaris web components)", "auto 150%")}
    ${tile("product-block.png", "100% 18%", "Product page block", "auto 165%")}
    ${tile("cart-drawer-added.png", "100% 0%", "Cart drawer: add-on at the offer price", "auto 150%")}
    ${tile("checkout.png", "100% 0%", "Checkout: discount from the Function", "auto 165%")}
  </div>
</body>`;

const browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 800, deviceScaleFactor: 1.25, mobile: false });
await page.setContent(html);
await page.screenshot({ path: "case/cover.png" });
await page.close();
await browser.close().catch(() => {});
console.log("case/cover.png");
