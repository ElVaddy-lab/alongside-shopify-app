import {
  DiscountClass,
  ProductDiscountSelectionStrategy,
  type CartInput,
  type CartLinesDiscountsGenerateRunResult,
  type ProductDiscountCandidateTarget,
  type ProductDiscountCandidateValue,
} from "../generated/api";

/**
 * One upsell offer, stored as JSON in the `$app:function-configuration`
 * metafield of the automatic discount that the admin creates for the offer.
 */
export interface OfferConfig {
  triggerProductIds: string[];
  offerProductIds: string[];
  discountType: "percentage" | "fixed_amount";
  /** Decimal as a string, e.g. "15.0" (percent) or "5.00" (store currency). */
  discountValue: string;
  message?: string;
}

const NO_DISCOUNT: CartLinesDiscountsGenerateRunResult = { operations: [] };

/**
 * Discounts the offered products when a trigger product is in the cart.
 * Each offered product is discounted on at most as many units as there are
 * trigger units in the cart (1 backpack -> 1 discounted sleeve).
 */
export function cartLinesDiscountsGenerateRun(
  input: CartInput,
): CartLinesDiscountsGenerateRunResult {
  if (!input.discount.discountClasses.includes(DiscountClass.Product)) {
    return NO_DISCOUNT;
  }

  const config = parseConfig(input.discount.metafield?.jsonValue);
  if (!config) {
    return NO_DISCOUNT;
  }

  let triggerUnits = 0;
  for (const line of input.cart.lines) {
    const productId = productIdOf(line);
    if (productId && config.triggerProductIds.includes(productId)) {
      triggerUnits += line.quantity;
    }
  }
  if (triggerUnits === 0) {
    return NO_DISCOUNT;
  }

  // Remaining discounted units per offered product.
  const allowance = new Map<string, number>();
  const targets: ProductDiscountCandidateTarget[] = [];
  for (const line of input.cart.lines) {
    const productId = productIdOf(line);
    if (!productId || !config.offerProductIds.includes(productId)) {
      continue;
    }
    const left = allowance.get(productId) ?? triggerUnits;
    const quantity = Math.min(line.quantity, left);
    if (quantity > 0) {
      targets.push({ cartLine: { id: line.id, quantity } });
      allowance.set(productId, left - quantity);
    }
  }
  if (targets.length === 0) {
    return NO_DISCOUNT;
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: [
            {
              message: config.message,
              targets,
              value: discountValue(config),
            },
          ],
          selectionStrategy: ProductDiscountSelectionStrategy.First,
        },
      },
    ],
  };
}

type CartLine = CartInput["cart"]["lines"][number];

function productIdOf(line: CartLine): string | undefined {
  return line.merchandise.__typename === "ProductVariant"
    ? line.merchandise.product.id
    : undefined;
}

function discountValue(config: OfferConfig): ProductDiscountCandidateValue {
  return config.discountType === "percentage"
    ? { percentage: { value: config.discountValue } }
    : { fixedAmount: { amount: config.discountValue, appliesToEachItem: true } };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

/** Returns a valid config, or null when the metafield is missing or wrong. */
export function parseConfig(value: unknown): OfferConfig | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const raw = value as Record<string, unknown>;
  if (!isStringArray(raw.triggerProductIds) || !isStringArray(raw.offerProductIds)) {
    return null;
  }
  if (raw.discountType !== "percentage" && raw.discountType !== "fixed_amount") {
    return null;
  }
  if (typeof raw.discountValue !== "string") {
    return null;
  }
  const amount = Number(raw.discountValue);
  if (!Number.isFinite(amount) || amount <= 0) {
    return null;
  }
  if (raw.discountType === "percentage" && amount > 100) {
    return null;
  }
  return {
    triggerProductIds: raw.triggerProductIds,
    offerProductIds: raw.offerProductIds,
    discountType: raw.discountType,
    discountValue: raw.discountValue,
    message: typeof raw.message === "string" ? raw.message : undefined,
  };
}
