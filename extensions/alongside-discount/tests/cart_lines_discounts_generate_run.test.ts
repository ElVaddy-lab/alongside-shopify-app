import { describe, expect, test } from "vitest";

import { cartLinesDiscountsGenerateRun } from "../src/cart_lines_discounts_generate_run";
import { DiscountClass, type CartInput } from "../generated/api";

const BACKPACK = "gid://shopify/Product/1001";
const SLEEVE = "gid://shopify/Product/2001";
const RAIN_COVER = "gid://shopify/Product/2002";
const WALLET = "gid://shopify/Product/3001";

type Line = CartInput["cart"]["lines"][number];

let lineCounter = 0;
function line(productId: string, quantity = 1): Line {
  lineCounter += 1;
  return {
    id: `gid://shopify/CartLine/${lineCounter}`,
    quantity,
    merchandise: { __typename: "ProductVariant", product: { id: productId } },
  };
}

const baseConfig = {
  triggerProductIds: [BACKPACK],
  offerProductIds: [SLEEVE, RAIN_COVER],
  discountType: "percentage",
  discountValue: "15.0",
  message: "Add-on offer: 15% off",
};

const NO_METAFIELD = Symbol("no metafield");

function input(
  lines: Line[],
  config: unknown = baseConfig,
  discountClasses: DiscountClass[] = [DiscountClass.Product],
): CartInput {
  return {
    cart: { lines },
    discount: {
      discountClasses,
      metafield: config === NO_METAFIELD ? null : { jsonValue: config },
    },
  };
}

function targetsOf(result: ReturnType<typeof cartLinesDiscountsGenerateRun>) {
  const op = result.operations[0];
  if (!op || !("productDiscountsAdd" in op) || !op.productDiscountsAdd) {
    throw new Error(`expected productDiscountsAdd, got ${JSON.stringify(result)}`);
  }
  return op.productDiscountsAdd.candidates[0].targets.map((t) => t.cartLine);
}

describe("no discount", () => {
  test("when the discount does not have the PRODUCT class", () => {
    const lines = [line(BACKPACK), line(SLEEVE)];
    const result = cartLinesDiscountsGenerateRun(
      input(lines, baseConfig, [DiscountClass.Order]),
    );
    expect(result).toEqual({ operations: [] });
  });

  test("when the configuration metafield is missing", () => {
    const result = cartLinesDiscountsGenerateRun(
      input([line(BACKPACK), line(SLEEVE)], NO_METAFIELD),
    );
    expect(result).toEqual({ operations: [] });
  });

  test("when the configuration is malformed", () => {
    const lines = [line(BACKPACK), line(SLEEVE)];
    for (const config of [
      null,
      "not an object",
      { ...baseConfig, offerProductIds: "gid://shopify/Product/2001" },
      { ...baseConfig, triggerProductIds: undefined },
      { ...baseConfig, discountType: "buy_one_get_one" },
      { ...baseConfig, discountValue: "abc" },
    ]) {
      expect(cartLinesDiscountsGenerateRun(input(lines, config))).toEqual({
        operations: [],
      });
    }
  });

  test("when the discount value is out of range", () => {
    const lines = [line(BACKPACK), line(SLEEVE)];
    for (const config of [
      { ...baseConfig, discountValue: "0" },
      { ...baseConfig, discountValue: "-5" },
      { ...baseConfig, discountValue: "100.01" },
      { ...baseConfig, discountType: "fixed_amount", discountValue: "0" },
    ]) {
      expect(cartLinesDiscountsGenerateRun(input(lines, config))).toEqual({
        operations: [],
      });
    }
  });

  test("when no trigger product is in the cart", () => {
    const result = cartLinesDiscountsGenerateRun(
      input([line(SLEEVE), line(WALLET)]),
    );
    expect(result).toEqual({ operations: [] });
  });

  test("when a trigger is in the cart but no offered product is", () => {
    const result = cartLinesDiscountsGenerateRun(
      input([line(BACKPACK), line(WALLET)]),
    );
    expect(result).toEqual({ operations: [] });
  });
});

describe("percentage discount", () => {
  test("discounts one offered unit for one trigger, with the offer message", () => {
    const sleeve = line(SLEEVE);
    const result = cartLinesDiscountsGenerateRun(
      input([line(BACKPACK), sleeve, line(WALLET)]),
    );

    expect(result).toEqual({
      operations: [
        {
          productDiscountsAdd: {
            candidates: [
              {
                message: "Add-on offer: 15% off",
                targets: [{ cartLine: { id: sleeve.id, quantity: 1 } }],
                value: { percentage: { value: "15.0" } },
              },
            ],
            selectionStrategy: "FIRST",
          },
        },
      ],
    });
  });

  test("never discounts more offered units than there are trigger units", () => {
    const sleeves = line(SLEEVE, 3);
    const result = cartLinesDiscountsGenerateRun(
      input([line(BACKPACK, 2), sleeves]),
    );
    expect(targetsOf(result)).toEqual([{ id: sleeves.id, quantity: 2 }]);
  });

  test("counts trigger units across several lines (variants) of the trigger product", () => {
    const sleeves = line(SLEEVE, 2);
    const result = cartLinesDiscountsGenerateRun(
      input([line(BACKPACK), line(BACKPACK), sleeves]),
    );
    expect(targetsOf(result)).toEqual([{ id: sleeves.id, quantity: 2 }]);
  });

  test("shares the allowance across several lines of the same offered product", () => {
    const greySleeve = line(SLEEVE, 1);
    const blackSleeve = line(SLEEVE, 2);
    const result = cartLinesDiscountsGenerateRun(
      input([line(BACKPACK, 2), greySleeve, blackSleeve]),
    );
    expect(targetsOf(result)).toEqual([
      { id: greySleeve.id, quantity: 1 },
      { id: blackSleeve.id, quantity: 1 },
    ]);
  });

  test("gives each offered product its own allowance", () => {
    const sleeve = line(SLEEVE);
    const rainCover = line(RAIN_COVER);
    const result = cartLinesDiscountsGenerateRun(
      input([line(BACKPACK), sleeve, rainCover]),
    );
    expect(targetsOf(result)).toEqual([
      { id: sleeve.id, quantity: 1 },
      { id: rainCover.id, quantity: 1 },
    ]);
  });

  test("ignores cart lines that are not product variants", () => {
    const sleeve = line(SLEEVE);
    const custom: Line = {
      id: "gid://shopify/CartLine/custom",
      quantity: 1,
      merchandise: { __typename: "CustomProduct" },
    };
    const result = cartLinesDiscountsGenerateRun(
      input([custom, line(BACKPACK), sleeve]),
    );
    expect(targetsOf(result)).toEqual([{ id: sleeve.id, quantity: 1 }]);
  });
});

describe("fixed amount discount", () => {
  test("takes the amount off each discounted unit", () => {
    const sleeves = line(SLEEVE, 2);
    const result = cartLinesDiscountsGenerateRun(
      input([line(BACKPACK, 2), sleeves], {
        ...baseConfig,
        discountType: "fixed_amount",
        discountValue: "5.00",
        message: "Add-on offer: 5.00 off",
      }),
    );

    expect(result).toEqual({
      operations: [
        {
          productDiscountsAdd: {
            candidates: [
              {
                message: "Add-on offer: 5.00 off",
                targets: [{ cartLine: { id: sleeves.id, quantity: 2 } }],
                value: { fixedAmount: { amount: "5.00", appliesToEachItem: true } },
              },
            ],
            selectionStrategy: "FIRST",
          },
        },
      ],
    });
  });
});
