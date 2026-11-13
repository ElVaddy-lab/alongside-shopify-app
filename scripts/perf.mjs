// Lighthouse (mobile) on the Roll-Top product page: the store's live theme
// without Alongside ("before") and its copy with the Alongside block and cart
// embed ("after"). Both are opened as theme previews, so Shopify's preview bar
// is present in both runs. Several runs each, median reported.
//
// The storefront is password protected: the session saved by the e2e `auth`
// project (e2e/.auth/storefront.json) is put into the browser's cookie jar
// (a static Cookie header is not enough: the preview redirect updates the
// session cookie), and Lighthouse runs without clearing storage. A run that
// ends on /password is an error, not a result.
//
//   node scripts/perf.mjs <beforeThemeId> <afterThemeId> [runs=5]
//
// Writes notes/perf/<label>-<n>.json (raw Lighthouse results) and prints a summary.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import lighthouse from "lighthouse";
import * as chromeLauncher from "chrome-launcher";
import puppeteer from "puppeteer-core";

const [beforeId, afterId, runsArg] = process.argv.slice(2);
if (!beforeId || !afterId) {
  console.error("usage: node scripts/perf.mjs <beforeThemeId> <afterThemeId> [runs]");
  process.exit(1);
}
const RUNS = Number(runsArg ?? 5);
const STORE = "https://ostriv.myshopify.com";
const PAGE = "/products/roll-top";
const OUT = "notes/perf";

const state = JSON.parse(fs.readFileSync("e2e/.auth/storefront.json", "utf8"));
const cookies = state.cookies
  .filter((c) => "ostriv.myshopify.com".endsWith(c.domain.replace(/^\./, "")))
  .map(({ name, value, domain, path: cookiePath, secure, httpOnly, sameSite, expires }) => ({
    name,
    value,
    domain,
    path: cookiePath,
    secure,
    httpOnly,
    sameSite,
    expires,
  }));

const chromePath =
  process.env.CHROME_PATH ??
  path.join(os.homedir(), "AppData/Local/ms-playwright/chromium-1254/chrome-win64/chrome.exe");

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

async function run(label, themeId) {
  const url = `${STORE}${PAGE}?preview_theme_id=${themeId}`;
  const results = [];
  for (let i = 1; i <= RUNS; i++) {
    const chrome = await chromeLauncher.launch({ chromePath, chromeFlags: ["--headless=new"] });
    const browser = await puppeteer.connect({ browserURL: `http://127.0.0.1:${chrome.port}` });
    try {
      const page = await browser.newPage();
      await browser.setCookie(...cookies);
      const { lhr } = await lighthouse(
        url,
        { port: chrome.port, output: "json", logLevel: "error", disableStorageReset: true },
        undefined,
        page,
      );
      const finalUrl = lhr.finalDisplayedUrl ?? "";
      if (lhr.runtimeError || !finalUrl.includes(PAGE)) {
        throw new Error(`${label} ${i}: ended on ${finalUrl} ${lhr.runtimeError?.message ?? ""}`);
      }
      fs.writeFileSync(path.join(OUT, `${label}-${i}.json`), JSON.stringify(lhr));
      const requests = lhr.audits["network-requests"].details.items;
      const ours = requests.filter((r) => /alongside\.(js|css)/.test(r.url));
      const appServer = requests.filter((r) => /ngrok|trycloudflare|vercel\.app/.test(r.url));
      const bootup = lhr.audits["bootup-time"].details?.items ?? [];
      const ourScript = bootup.find((b) => /alongside\.js/.test(b.url));
      const blocking = lhr.audits["render-blocking-insight"]?.details?.items ?? [];
      results.push({
        ourRenderBlocking: blocking.filter((r) => /alongside/.test(r.url)).length,
        score: Math.round(lhr.categories.performance.score * 100),
        a11y: Math.round(lhr.categories.accessibility.score * 100),
        lcp: lhr.audits["largest-contentful-paint"].numericValue,
        tbt: lhr.audits["total-blocking-time"].numericValue,
        cls: lhr.audits["cumulative-layout-shift"].numericValue,
        bytes: lhr.audits["total-byte-weight"].numericValue,
        requests: requests.length,
        ourBytes: ours.reduce((sum, r) => sum + (r.transferSize ?? 0), 0),
        ourRequests: ours.length,
        appServerRequests: appServer.length,
        ourScriptMs: ourScript ? ourScript.total : 0,
        benchmark: lhr.environment.benchmarkIndex,
      });
      console.log(label, i, JSON.stringify(results.at(-1)));
    } finally {
      await browser.disconnect();
      await chrome.kill();
    }
  }
  const pick = (key) => median(results.map((r) => r[key]));
  return Object.fromEntries(Object.keys(results[0]).map((key) => [key, pick(key)]));
}

fs.mkdirSync(OUT, { recursive: true });
const before = await run("before", beforeId);
const after = await run("after", afterId);
const summary = { page: PAGE, runs: RUNS, date: new Date().toISOString(), before, after };
fs.writeFileSync(path.join(OUT, "summary.json"), JSON.stringify(summary, null, 2));
console.log("\nMEDIAN", JSON.stringify(summary, null, 2));
