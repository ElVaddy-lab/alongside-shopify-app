// Title cards (1600×900 PNG) rendered from HTML in a separate tab of the recording browser.
import fs from "node:fs";
import { chromium } from "playwright-core";
const SP = process.env.SP;

const css = `
  * { box-sizing: border-box; margin: 0; }
  body { width: 1280px; height: 720px; background: #15171a; color: #f2f0eb; font-family: "Segoe UI", system-ui, sans-serif;
         padding: 72px 96px; display: flex; flex-direction: column; justify-content: center; gap: 28px; }
  .kicker { color: #f08c4a; font-size: 20px; letter-spacing: .14em; text-transform: uppercase; font-weight: 600; }
  h1 { font-size: 64px; line-height: 1.05; font-weight: 700; letter-spacing: -0.01em; }
  h2 { font-size: 40px; line-height: 1.15; font-weight: 650; }
  p, li { font-size: 24px; line-height: 1.45; color: #d4d1ca; }
  ul { padding-left: 1.1em; display: grid; gap: 10px; }
  .note { font-size: 18px; color: #9b978f; }
  .flow { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }
  .box { border: 1px solid #3a3d42; border-radius: 12px; padding: 18px 20px; background: #1d2024; }
  .box b { display: block; font-size: 22px; color: #fff; margin-bottom: 6px; }
  .box span { font-size: 18px; color: #b9b5ad; line-height: 1.4; display: block; }
  .box b .arrow { display: inline; font-size: inherit; color: #f08c4a; margin: 0; }
  .nums { display: grid; grid-template-columns: 1fr 1fr; gap: 14px 40px; }
  .nums div { font-size: 22px; color: #d4d1ca; line-height: 1.35; }
  .nums b { color: #fff; font-size: 30px; display: block; }
`;

const cards = {
  intro: `
    <div class="kicker">Portfolio demo · custom Shopify app</div>
    <h1>Alongside — add-on offers<br>in the cart and on the product page</h1>
    <p>A custom app in place of a paid "frequently bought together" app: an embedded admin,
       a theme app extension and a Shopify Discount Function.</p>
    <p class="note">Ostiv is a demo store: products and prices are fictional, orders are not fulfilled.
       Recorded on an unpublished copy of its theme. No sales figures are claimed.</p>`,
  how: `
    <div class="kicker">How it works</div>
    <h2>One form in the admin, two things in Shopify</h2>
    <div class="flow">
      <div class="box"><b>Admin</b><span>React Router + Polaris web components, embedded in Shopify; hosted on Vercel</span></div>
      <div class="box"><b><span class="arrow">→</span> Metaobject</b><span>App-owned offer entry; the theme reads it in Liquid — the storefront never calls the app server</span></div>
      <div class="box"><b><span class="arrow">→</span> Automatic discount</b><span>Its JSON config drives the Discount Function (TypeScript → WebAssembly) in cart and checkout</span></div>
    </div>
    <p>Add to cart uses Shopify's standard storefront actions, so the theme refreshes its own cart.
       Without JavaScript, each add-on is a plain form.</p>`,
  quality: `
    <div class="kicker">Measured, 13 Nov 2026</div>
    <h2>Tests and storefront cost</h2>
    <div class="nums">
      <div><b>21 + 18</b>admin unit tests · function unit and Wasm fixture tests</div>
      <div><b>7 × 2 themes</b>end-to-end tests on a Horizon copy and Dawn, checkout included</div>
      <div><b>0</b>axe violations (WCAG 2.2 A/AA) in the product block and cart offer</div>
      <div><b>0.29–0.41 M</b>function instructions on real carts (limit 11 M)</div>
      <div><b>1 request · 2.1 KB</b>gzip JS added to the page; no render-blocking resources</div>
      <div><b>37 → 37</b>Lighthouse mobile Performance, store page without vs. with the app</div>
    </div>`,
  outro: `
    <div class="kicker">Alongside</div>
    <h2>What's in the repository</h2>
    <ul>
      <li>README: architecture, local setup, deploy, rollback, known limitations</li>
      <li>STAFF-GUIDE: create, change and turn off offers — for store staff</li>
      <li>Tests: Vitest, Function fixtures, Playwright + axe on two themes, Lighthouse script</li>
    </ul>
    <p class="note">Shopify CLI 5 · React Router 7 · Admin API 2026-10 · Discount Function API 2026-10 · Liquid · Prisma + Postgres</p>`,
};

const browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
const ctx = browser.contexts()[0];
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 720, deviceScaleFactor: 1.25, mobile: false });
fs.mkdirSync(`${SP}/cards`, { recursive: true });
for (const [name, html] of Object.entries(cards)) {
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>${css}</style><body>${html}</body>`);
  await page.screenshot({ path: `${SP}/cards/${name}.png` });
}
await page.close();
await browser.close().catch(() => {});
console.log("cards:", Object.keys(cards).join(", "));
