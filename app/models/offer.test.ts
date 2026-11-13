import { describe, expect, test } from "vitest";

import {
  discountInput,
  discountLabel,
  functionConfig,
  metaobjectFields,
  offerFromMetaobject,
  offerMessage,
  parseOfferForm,
  type OfferDraft,
} from "./offer";
import { parseConfig } from "../../extensions/alongside-discount/src/cart_lines_discounts_generate_run";

const BACKPACK = "gid://shopify/Product/1001";
const SLEEVE = "gid://shopify/Product/2001";
const RAIN_COVER = "gid://shopify/Product/2002";

function form(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const values: Record<string, string> = {
    title: "Backpack add-ons",
    heading: "Complete your setup",
    triggerProductIds: JSON.stringify([BACKPACK]),
    offerProductIds: JSON.stringify([SLEEVE, RAIN_COVER]),
    discountType: "percentage",
    discountValue: "15",
    showOnProduct: "on",
    showInCart: "on",
    ...overrides,
  };
  for (const [key, value] of Object.entries(values)) data.set(key, value);
  return data;
}

const draft: OfferDraft = {
  title: "Backpack add-ons",
  heading: "Complete your setup",
  triggerProductIds: [BACKPACK],
  offerProductIds: [SLEEVE, RAIN_COVER],
  discountType: "percentage",
  discountValue: "15",
  showOnProduct: true,
  showInCart: true,
};

describe("parseOfferForm", () => {
  test("reads a valid form into a draft with no errors", () => {
    expect(parseOfferForm(form())).toEqual({ draft, errors: {} });
  });

  test("trims text and treats a missing checkbox as off", () => {
    const data = form({ title: "  Backpack add-ons  " });
    data.delete("showOnProduct");
    const { draft: parsed, errors } = parseOfferForm(data);
    expect(errors).toEqual({});
    expect(parsed.title).toBe("Backpack add-ons");
    expect(parsed.showOnProduct).toBe(false);
  });

  test("requires a name and a customer heading", () => {
    const { errors } = parseOfferForm(form({ title: " ", heading: "" }));
    expect(errors.title).toBeTruthy();
    expect(errors.heading).toBeTruthy();
  });

  test("requires at least one trigger product", () => {
    const { errors } = parseOfferForm(form({ triggerProductIds: "[]" }));
    expect(errors.triggerProductIds).toBeTruthy();
  });

  test("requires one to three offered products", () => {
    expect(parseOfferForm(form({ offerProductIds: "[]" })).errors.offerProductIds).toBeTruthy();
    const four = JSON.stringify([SLEEVE, RAIN_COVER, "gid://shopify/Product/2003", "gid://shopify/Product/2004"]);
    expect(parseOfferForm(form({ offerProductIds: four })).errors.offerProductIds).toBeTruthy();
  });

  test("rejects a product that is both a trigger and an offer", () => {
    const { errors } = parseOfferForm(form({ offerProductIds: JSON.stringify([BACKPACK]) }));
    expect(errors.offerProductIds).toBeTruthy();
  });

  test("rejects product lists that are not lists of product IDs", () => {
    expect(parseOfferForm(form({ triggerProductIds: "not json" })).errors.triggerProductIds).toBeTruthy();
    expect(
      parseOfferForm(form({ triggerProductIds: JSON.stringify(["gid://shopify/Collection/1"]) })).errors
        .triggerProductIds,
    ).toBeTruthy();
  });

  test("checks the discount value against its type", () => {
    for (const [discountType, discountValue] of [
      ["percentage", "0"],
      ["percentage", "100.5"],
      ["percentage", "abc"],
      ["fixed_amount", "-1"],
      ["fixed_amount", "5.555"],
    ]) {
      const { errors } = parseOfferForm(form({ discountType, discountValue }));
      expect(errors.discountValue, `${discountType} ${discountValue}`).toBeTruthy();
    }
    expect(parseOfferForm(form({ discountType: "bogo" })).errors.discountType).toBeTruthy();
    expect(parseOfferForm(form({ discountType: "fixed_amount", discountValue: "5.5" })).errors).toEqual({});
  });
});

describe("discountLabel", () => {
  test("describes a percentage", () => {
    expect(discountLabel(draft, "EUR")).toBe("15% off");
  });

  test("describes a fixed amount per add-on in the store currency", () => {
    expect(discountLabel({ ...draft, discountType: "fixed_amount", discountValue: "5" }, "USD")).toBe(
      "$5.00 off",
    );
  });
});

describe("offerMessage", () => {
  test("shows the percentage after the heading", () => {
    expect(offerMessage(draft, "EUR")).toBe("Complete your setup: 15% off");
  });

  test("formats a fixed amount in the store currency", () => {
    expect(
      offerMessage({ ...draft, discountType: "fixed_amount", discountValue: "5" }, "EUR"),
    ).toBe("Complete your setup: €5.00 off");
  });
});

describe("functionConfig", () => {
  test("builds the JSON the discount function reads", () => {
    expect(functionConfig(draft, "EUR")).toEqual({
      triggerProductIds: [BACKPACK],
      offerProductIds: [SLEEVE, RAIN_COVER],
      discountType: "percentage",
      discountValue: "15.0",
      message: "Complete your setup: 15% off",
    });
  });

  test("writes a fixed amount with two decimals", () => {
    const config = functionConfig({ ...draft, discountType: "fixed_amount", discountValue: "5.5" }, "EUR");
    expect(config.discountValue).toBe("5.50");
  });

  test("is accepted unchanged by the discount function (shared contract)", () => {
    for (const d of [draft, { ...draft, discountType: "fixed_amount" as const, discountValue: "5.5" }]) {
      const config = functionConfig(d, "EUR");
      expect(parseConfig(config)).toEqual(config);
    }
  });
});

describe("discountInput", () => {
  test("creates an automatic app discount on the Alongside function with the offer config", () => {
    const input = discountInput(draft, "EUR", { create: true });
    expect(input).toMatchObject({
      title: "Alongside · Backpack add-ons",
      functionHandle: "alongside-discount",
      discountClasses: ["PRODUCT"],
      combinesWith: { orderDiscounts: true, shippingDiscounts: true, productDiscounts: false },
    });
    expect(input.startsAt).toEqual(expect.any(String));
    expect(input.metafields).toEqual([
      {
        namespace: "$app",
        key: "function-configuration",
        type: "json",
        value: JSON.stringify(functionConfig(draft, "EUR")),
      },
    ]);
  });

  test("on update leaves the function and start date unchanged", () => {
    const input = discountInput(draft, "EUR", { create: false });
    expect(input).not.toHaveProperty("functionHandle");
    expect(input).not.toHaveProperty("startsAt");
  });
});

describe("metaobject round trip", () => {
  test("fields store every draft value as metaobject strings", () => {
    expect(metaobjectFields(draft, "gid://shopify/DiscountAutomaticNode/9")).toEqual([
      { key: "title", value: "Backpack add-ons" },
      { key: "heading", value: "Complete your setup" },
      { key: "trigger_products", value: JSON.stringify([BACKPACK]) },
      { key: "offer_products", value: JSON.stringify([SLEEVE, RAIN_COVER]) },
      { key: "discount_type", value: "percentage" },
      { key: "discount_value", value: "15.0" },
      { key: "show_on_product", value: "true" },
      { key: "show_in_cart", value: "true" },
      { key: "discount_id", value: "gid://shopify/DiscountAutomaticNode/9" },
    ]);
  });

  test("an offer read back from its metaobject matches the saved draft", () => {
    const fields = metaobjectFields(draft, "gid://shopify/DiscountAutomaticNode/9");
    const offer = offerFromMetaobject({
      id: "gid://shopify/Metaobject/5",
      handle: "backpack-add-ons",
      fields,
      capabilities: { publishable: { status: "ACTIVE" } },
    });
    expect(offer).toEqual({
      id: "gid://shopify/Metaobject/5",
      handle: "backpack-add-ons",
      enabled: true,
      discountId: "gid://shopify/DiscountAutomaticNode/9",
      ...draft,
      discountValue: "15.0",
    });
  });

  test("restores two decimals on a fixed amount that Shopify stored shortened", () => {
    // number_decimal fields come back canonical: "4.00" is stored as "4.0".
    const fields = metaobjectFields({ ...draft, discountType: "fixed_amount", discountValue: "4" }, null).map(
      (f) => (f.key === "discount_value" ? { ...f, value: "4.0" } : f),
    );
    const offer = offerFromMetaobject({
      id: "gid://shopify/Metaobject/5",
      handle: "x",
      fields,
      capabilities: { publishable: { status: "ACTIVE" } },
    });
    expect(offer.discountValue).toBe("4.00");
  });

  test("a draft metaobject is a disabled offer", () => {
    const offer = offerFromMetaobject({
      id: "gid://shopify/Metaobject/5",
      handle: "x",
      fields: metaobjectFields(draft, null),
      capabilities: { publishable: { status: "DRAFT" } },
    });
    expect(offer.enabled).toBe(false);
    expect(offer.discountId).toBeNull();
  });
});
