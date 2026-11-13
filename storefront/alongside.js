/**
 * Alongside storefront script (product block and cart embed).
 *
 * Each add-on is a plain <form action="/cart/add">, so it works without
 * JavaScript. When the storefront exposes Shopify's standard actions, the add
 * goes through Shopify.actions.updateCart instead: the theme refreshes its own
 * cart UI and standard cart events fire, with no theme-specific code here.
 * Listeners are delegated to the document, so forms re-rendered by the theme
 * (cart drawer) keep working.
 */
(() => {
  if (window.__alongside) return;
  window.__alongside = true;

  const statusOf = (form) => form.closest("[data-alongside-offer]")?.querySelector("[data-alongside-status]");
  const textOf = (form, key) => form.closest("[data-alongside-root]")?.dataset[key] || "";

  function announce(status, message, isError) {
    if (!status) return;
    status.textContent = "";
    status.classList.toggle("alongside__status--error", Boolean(isError));
    // Set after clearing so repeated messages are announced again.
    requestAnimationFrame(() => {
      status.textContent = message;
    });
  }

  document.addEventListener("submit", async (event) => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.hasAttribute("data-alongside-form")) return;

    const actions = window.Shopify && window.Shopify.actions;
    if (!actions || typeof actions.updateCart !== "function") return; // native POST to /cart/add

    event.preventDefault();
    const button = form.querySelector('[type="submit"]');
    if (button?.getAttribute("aria-busy") === "true") return;
    button?.setAttribute("aria-busy", "true");

    const data = new FormData(form);
    const offer = form.closest("[data-alongside-offer]");
    const context = offer?.dataset.context === "cart" ? "cart" : "product";
    const added = textOf(form, "added");
    if (context === "cart") cart.expectFocus(form, added);
    try {
      const result = await actions.updateCart(
        {
          lines: [
            {
              merchandiseId: String(data.get("id")),
              quantity: 1,
              attributes: [{ key: "_alongside_offer", value: String(data.get("properties[_alongside_offer]")) }],
            },
          ],
        },
        { event: { context } },
      );
      if (result?.userErrors?.length) {
        cart.expectFocus(null);
        announce(statusOf(form), result.userErrors[0].message, true);
        return;
      }
      if (context === "product") {
        announce(statusOf(form), added, false);
        if (typeof actions.openCart === "function") await actions.openCart();
      } else {
        cart.refresh();
      }
    } catch {
      cart.expectFocus(null);
      announce(statusOf(form), textOf(form, "error"), true);
    } finally {
      if (button?.isConnected) button.removeAttribute("aria-busy");
    }
  });

  // Variant picker: show the selected variant's regular and discounted price.
  document.addEventListener("change", (event) => {
    const select = event.target;
    if (!(select instanceof HTMLSelectElement) || !select.hasAttribute("data-alongside-variant")) return;
    const option = select.selectedOptions[0];
    const price = select.form?.querySelector("[data-alongside-price]");
    if (!option || !price) return;
    const [compare, sale] = price.querySelectorAll(".alongside__compare, .alongside__sale");
    const replaceAmount = (el, amount) => {
      const label = el.firstElementChild; // visually hidden "Regular price" / "Sale price"
      el.replaceChildren(label, document.createTextNode(amount));
    };
    if (compare && option.dataset.compare) replaceAmount(compare, option.dataset.compare);
    if (sale && option.dataset.sale) replaceAmount(sale, option.dataset.sale);
  });

  /**
   * Cart embed: inserts the offers whose trigger is in the cart after the
   * theme's cart form (drawer and cart page). Themes re-render the cart after
   * every change, which removes the inserted block; a MutationObserver puts it
   * back with fresh cart data, so no theme-specific events are needed.
   */
  const cart = (() => {
    const source = document.querySelector("[data-alongside-cart-source]");
    const DEFAULT_ANCHORS = [
      "cart-items-component form.cart-form", // Horizon: drawer and cart page
      "cart-drawer-items #CartDrawer-Form", // Dawn: drawer
      "cart-items form#cart", // Dawn: cart page
    ];
    const selectors = () => (source?.dataset.anchor ? [source.dataset.anchor] : DEFAULT_ANCHORS);
    const query = (selector) => {
      try {
        return [...document.querySelectorAll(selector)];
      } catch {
        return []; // invalid selector in the theme editor setting
      }
    };
    const anchors = () => selectors().flatMap(query);
    const hostAfter = (anchor) =>
      anchor.nextElementSibling?.hasAttribute("data-alongside-cart") ? anchor.nextElementSibling : null;

    let pending = null; // { handle, anchor, message } after an add from the cart
    let running = false;
    let again = false;

    async function refresh(attempt = 1) {
      if (!source) return;
      if (running) {
        again = true;
        return;
      }
      running = true;
      try {
        const root = window.Shopify?.routes?.root || "/";
        const response = await fetch(`${root}cart.js`, { headers: { Accept: "application/json" } });
        if (response.ok) render(await response.json());
        // Storefront rate limit: try again a little later (3 attempts).
        else if (response.status === 429 && attempt < 3) setTimeout(() => refresh(attempt + 1), 2000 * attempt);
      } catch {
        // Offline or blocked: leave the cart as the theme rendered it.
      } finally {
        running = false;
        if (again) {
          again = false;
          refresh();
        }
      }
    }

    function render(cartData) {
      const quantities = new Map();
      for (const item of cartData.items) {
        const id = String(item.product_id);
        quantities.set(id, (quantities.get(id) || 0) + item.quantity);
      }
      const signature = [...quantities].sort().join(";");

      let changed = false;
      for (const anchor of anchors()) {
        const existing = hostAfter(anchor);
        if (existing && existing.dataset.signature === signature) continue;
        if (existing) existing.remove();
        anchor.after(build(quantities, signature));
        changed = true;
      }
      // Standard cart events fire as the change starts; wait for a real change.
      if (changed) restoreFocus();
    }

    function build(quantities, signature) {
      const host = document.createElement("div");
      host.className = "alongside-cart";
      host.setAttribute("data-alongside-cart", "");
      host.setAttribute("data-alongside-root", "");
      host.dataset.signature = signature;
      host.dataset.added = source.dataset.added;
      host.dataset.error = source.dataset.error;

      for (const template of source.querySelectorAll("template[data-alongside-cart-offer]")) {
        const triggers = (template.dataset.triggers || "").split(",");
        if (!triggers.some((id) => quantities.has(id))) continue;
        const offer = template.content.cloneNode(true);
        // Add-ons already in the cart are not offered again.
        for (const item of offer.querySelectorAll("[data-product-id]")) {
          if (quantities.has(item.dataset.productId)) item.remove();
        }
        if (offer.querySelector("[data-product-id]")) host.append(offer);
      }
      // An empty host stays as a hidden marker, so the observer does not
      // refetch the cart on every DOM change when no offer applies.
      host.hidden = host.childElementCount === 0;
      return host;
    }

    // Polite live region outside the cart, for when the offer itself is gone.
    let announcer = null;
    function liveRegion() {
      if (!announcer?.isConnected) {
        announcer = document.createElement("div");
        announcer.className = "alongside__visually-hidden";
        announcer.setAttribute("role", "status");
        document.body.append(announcer);
      }
      return announcer;
    }

    function restoreFocus() {
      if (!pending) return;
      const { handle, anchor, message } = pending;
      pending = null;
      const findStatus = () =>
        document
          .querySelector(`[data-alongside-cart] [data-alongside-offer="${CSS.escape(handle)}"]`)
          ?.querySelector("[data-alongside-status]");
      const status = findStatus();
      announce(status || liveRegion(), message, false);

      // The clicked button was replaced, and the theme may re-render the cart
      // once more after this; for a short while, put focus back in the same
      // cart (drawer or page) whenever it falls to <body>: the offer's status
      // line if the offer is still there, otherwise that cart's form.
      const until = Date.now() + 2500;
      const ensure = () => {
        const lost = !document.activeElement || document.activeElement === document.body;
        if (lost) {
          const visible = (el) =>
            el.checkVisibility ? el.checkVisibility({ visibilityProperty: true }) : el.offsetParent !== null;
          const target = findStatus() || (anchor && query(anchor).find(visible));
          if (target) {
            target.tabIndex = -1;
            target.focus({ preventScroll: true });
          }
        }
        if (Date.now() < until) setTimeout(ensure, 150);
      };
      ensure();
    }

    if (source) {
      let scheduled = false;
      new MutationObserver(() => {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
          scheduled = false;
          // Only when a cart form lost (or never had) its offers block.
          if (anchors().some((anchor) => !hostAfter(anchor))) refresh();
        });
      }).observe(document.body, { childList: true, subtree: true });
      document.addEventListener("shopify:cart:lines-update", (event) => {
        Promise.resolve(event.promise).finally(refresh);
      });
      refresh();
    }

    return {
      refresh,
      /** Remember which cart (drawer or page) the add came from. */
      expectFocus(form, message) {
        if (!form) {
          pending = null;
          return;
        }
        const formAnchor = form.closest("[data-alongside-cart]")?.previousElementSibling;
        pending = {
          handle: form.closest("[data-alongside-offer]")?.dataset.alongsideOffer || "",
          anchor: selectors().find((selector) => query(selector).includes(formAnchor)) || null,
          message,
        };
      },
    };
  })();
})();
