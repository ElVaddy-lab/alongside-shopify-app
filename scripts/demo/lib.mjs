// Helpers for driving the recording browser (Chromium started with
// --remote-debugging-port=9333 and a separate profile in e2e/.auth/).
import { chromium } from "playwright-core";

export const SP = process.env.SP ?? ".";
export const ADMIN = "https://admin.shopify.com/store/ostriv";
export const STORE = "https://ostriv.myshopify.com";
export const W = 1280;
export const H = 720;

export async function connect(metrics = { width: W, height: H, deviceScaleFactor: 1.5, mobile: false }) {
  const browser = await chromium.connectOverCDP("http://127.0.0.1:9333");
  const ctx = browser.contexts()[0];
  const page = ctx.pages().find((p) => /^https?:/.test(p.url())) ?? (await ctx.newPage());
  page.on("dialog", (d) => d.accept().catch(() => {}));
  await page.bringToFront();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setDeviceMetricsOverride", metrics);
  return { browser, ctx, page, cdp };
}

export const app = (page) => page.frameLocator('iframe[name="app-iframe"]');
export const shot = (page, name) => page.screenshot({ path: `${SP}/${name}.png` });

/**
 * Records the tab with the DevTools screencast (JPEG frames + timestamps).
 * Frames come only when the screen changes; the assembler holds each frame
 * until the next one. Captions are kept as timed events for burning in later.
 */
import fs from "node:fs";
import path from "node:path";

export async function record(ctx, page, dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  let cdp = await ctx.newCDPSession(page);
  const frames = [];
  const captions = [];
  const t0 = Date.now() / 1000;
  let n = 0;
  const onFrame = async ({ data, sessionId, metadata }) => {
    const file = `f${String(n++).padStart(5, "0")}.jpg`;
    fs.writeFileSync(path.join(dir, file), Buffer.from(data, "base64"));
    frames.push({ file, t: (metadata.timestamp ?? Date.now() / 1000) - t0 });
    cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
  };
  const start = async () => {
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1.5, mobile: false });
    cdp.on("Page.screencastFrame", onFrame);
    await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080 });
  };
  await start();
  // A cross-origin navigation can move the tab to a new renderer; restart then.
  const onNav = async (frame) => {
    if (frame !== page.mainFrame()) return;
    try {
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: 1920, maxHeight: 1080 });
    } catch {
      cdp = await ctx.newCDPSession(page);
      await start();
    }
  };
  page.on("framenavigated", onNav);
  let open = null;
  return {
    /** Shows `text` from now until the next caption (or `clear()`). */
    caption(text) {
      const t = Date.now() / 1000 - t0;
      if (open) open.end = t;
      open = text ? { start: t, text } : null;
      if (open) captions.push(open);
    },
    clear() { this.caption(null); },
    async stop() {
      const end = Date.now() / 1000 - t0;
      if (open) open.end = end;
      page.off("framenavigated", onNav);
      await cdp.send("Page.stopScreencast").catch(() => {});
      fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify({ end, frames, captions }, null, 1));
      return { frames: frames.length, end };
    },
  };
}

/** Outline an element for a moment, then click it — viewers see what is clicked. */
export async function press(locator, { hold = 700, click = true } = {}) {
  await locator.scrollIntoViewIfNeeded();
  await locator.evaluate((el) => {
    el.dataset.demoOutline = el.style.outline;
    el.style.outline = "3px solid #e8590c";
    el.style.outlineOffset = "3px";
    el.style.borderRadius ||= "6px";
  });
  await new Promise((r) => setTimeout(r, hold));
  await locator.evaluate((el) => { el.style.outline = el.dataset.demoOutline ?? ""; }).catch(() => {});
  if (click) await locator.click();
}

export const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Storefront password session saved by the e2e `auth` project — only when the
 * recording profile has none yet (re-adding it would also swap in an old cart).
 */
export async function storefrontCookies(ctx) {
  const have = await ctx.cookies("https://ostriv.myshopify.com");
  if (have.some((c) => c.name === "_shopify_essential")) return;
  const state = JSON.parse(fs.readFileSync("e2e/.auth/storefront.json", "utf8"));
  await ctx.addCookies(state.cookies.filter((c) => c.domain.includes("ostriv")));
}

/** Hide Shopify's floating Sidekick prompt (it covers the bottom of the app). */
export async function hideSidekick(page) {
  await page.addStyleTag({ content: `[class*="_GlobalRibbonContainer_"] { display: none !important; }` }).catch(() => {});
}

/**
 * Page chrome hidden in every document of the tab: the theme preview bar in the
 * storefront (the theme is an unpublished copy; the intro card says so) and
 * Shopify's floating Sidekick prompt in the admin (it covers the app).
 */
export async function storefrontChrome(page) {
  await page.addInitScript(() => {
    const css = location.hostname.includes("ostriv")
      ? "#PBarNextFrameWrapper, #preview-bar-iframe { display: none !important; }"
      : location.hostname === "admin.shopify.com"
        ? "[class*=\"_GlobalRibbonContainer_\"] { display: none !important; }"
        : null;
    if (!css) return;
    const add = () => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.append(style);
    };
    if (document.head) add();
    else document.addEventListener("DOMContentLoaded", add);
  });
}

/**
 * Smoothly scroll the element's scroll container so the element sits `offset` px
 * below the top. Horizon scrolls an inner .page-wrapper, not the window, so the
 * nearest scrollable ancestor is animated (eased, ~0.9 s).
 */
export async function glide(page, locator, offset = 120) {
  await locator.evaluate(async (el, off) => {
    let box = el;
    while (box && box.getBoundingClientRect().height === 0) box = box.firstElementChild;
    let scroller = el.parentElement;
    while (scroller && !(/(auto|scroll)/.test(getComputedStyle(scroller).overflowY) && scroller.scrollHeight > scroller.clientHeight)) scroller = scroller.parentElement;
    scroller ??= document.scrollingElement;
    const from = scroller.scrollTop;
    const top = (box ?? el).getBoundingClientRect().top - (scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top);
    const to = from + top - off;
    const t0 = performance.now();
    await new Promise((done) => {
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 900);
        scroller.scrollTop = from + (to - from) * (1 - Math.pow(1 - k, 3));
        k < 1 ? requestAnimationFrame(step) : done();
      };
      requestAnimationFrame(step);
    });
  }, offset);
  await pause(300);
}

export async function emptyCart(page) {
  await page.evaluate(() => fetch("/cart/clear.js", { method: "POST" }));
}

/**
 * Clears the storefront's local/session storage: after leaving for checkout with
 * the drawer open, Horizon reopens it (and locks scrolling) on the next page load.
 */
export async function freshStorefront(page) {
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
}

/**
 * Smooth-scroll the element's own document so it sits `offset` px from the top.
 * Polaris hosts like <s-section> have no box (display: contents), so the first
 * child with a box is measured instead.
 */
export async function reveal(locator, offset = 24) {
  await locator.evaluate((el, off) => {
    const candidates = [el, ...el.children, ...(el.shadowRoot ? el.shadowRoot.children : [])];
    const box = candidates.map((c) => c.getBoundingClientRect()).find((r) => r.height > 0);
    if (box) document.scrollingElement.scrollBy({ top: box.top - off, behavior: "smooth" });
  }, offset);
  await pause(1400);
}

/** Close the theme's cart drawer if it opened by itself on page load. */
export async function closeDrawer(page) {
  for (let i = 0; i < 3; i++) {
    const open = await page.evaluate(() => [...document.querySelectorAll("dialog[open]")].some((d) => d.offsetHeight > 0));
    if (!open) return;
    await page.keyboard.press("Escape");
    await pause(700);
  }
}
