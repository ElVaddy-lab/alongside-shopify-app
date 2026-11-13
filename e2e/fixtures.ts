import { test as base, expect, type Page } from "@playwright/test";

export interface CartLine {
  product_title: string;
  variant_id: number;
  quantity: number;
  final_line_price: number;
  properties: Record<string, string> | null;
  discounts: { title: string }[];
}

/**
 * Variants used by the tests (dev store catalog, read once from the Admin API).
 * Hard-coded so the tests don't call /products/*.js, which the storefront
 * rate-limits (HTTP 429) when the suite runs repeatedly.
 */
export const VARIANTS = {
  "roll-top": 50320008872157, // Ink / M
  "rain-cover": 50319728967901, // Signal / M
  "key-leash": 50319728836829,
} as const;

/** Slower polling for cart checks — every poll is a /cart.js request. */
export const CART_POLL = { intervals: [1_000, 2_000, 3_000] };

/** Storefront helpers bound to one unpublished theme (preview_theme_id). */
export class Shop {
  constructor(
    readonly page: Page,
    readonly themeId: string,
  ) {}

  url(path: string) {
    const url = new URL(path, "https://x");
    url.searchParams.set("preview_theme_id", this.themeId);
    return `${url.pathname}${url.search}`;
  }

  async goto(path: string) {
    await this.page.goto(this.url(path));
    await expect(this.page).not.toHaveURL(/\/password/);
  }

  /**
   * AJAX API call in the page's session (same cart cookie). The storefront
   * answers 429 when tests run in quick succession, so back off and retry.
   */
  async ajax<T>(path: string, body?: unknown): Promise<T> {
    return this.page.evaluate(
      async ({ path, body }) => {
        for (let attempt = 1; ; attempt++) {
          const response = await fetch(path, {
            method: body ? "POST" : "GET",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: body ? JSON.stringify(body) : undefined,
          });
          if (response.status === 429 && attempt < 8) {
            await new Promise((resolve) => setTimeout(resolve, Math.min(5000 * attempt, 30_000)));
            continue;
          }
          if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
          return response.json();
        }
      },
      { path, body },
    );
  }

  /** Cart lines from the AJAX API, in the page's session. */
  async cart(): Promise<CartLine[]> {
    return (await this.ajax<{ items: CartLine[] }>("/cart.js")).items;
  }

  async line(title: string) {
    return (await this.cart()).find((line) => line.product_title === title);
  }

  async addToCart(handle: keyof typeof VARIANTS) {
    await this.ajax("/cart/add.js", { items: [{ id: VARIANTS[handle], quantity: 1 }] });
  }

  async openCart() {
    await this.page.evaluate(() => (window as unknown as { Shopify: { actions: { openCart(): Promise<void> } } }).Shopify.actions.openCart());
  }
}

export const test = base.extend<{ themeId: string; shop: Shop }>({
  themeId: ["", { option: true }],
  shop: async ({ page, themeId }, use) => {
    await use(new Shop(page, themeId));
    // Spread cart writes out a little (storefront rate limit on /cart/add).
    await new Promise((resolve) => setTimeout(resolve, 4_000));
  },
});

export { expect };
