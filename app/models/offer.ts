/**
 * Upsell offer: form parsing and validation, and conversion to the two places
 * an offer is stored in Shopify — the `$app:upsell_offer` metaobject (read by
 * the theme) and the automatic discount with its JSON configuration (read by
 * the discount function). Both are built from the same draft, so the price
 * the storefront shows and the price at checkout come from one source.
 */

export const OFFER_TYPE = "$app:upsell_offer";
export const FUNCTION_HANDLE = "alongside-discount";
export const CONFIG_NAMESPACE = "$app";
export const CONFIG_KEY = "function-configuration";
export const MAX_OFFER_PRODUCTS = 3;

export type DiscountType = "percentage" | "fixed_amount";

export interface OfferDraft {
  title: string;
  heading: string;
  triggerProductIds: string[];
  offerProductIds: string[];
  discountType: DiscountType;
  /** As entered, e.g. "15" or "5.5"; normalised when stored. */
  discountValue: string;
  showOnProduct: boolean;
  showInCart: boolean;
}

export interface Offer extends OfferDraft {
  id: string;
  handle: string;
  enabled: boolean;
  discountId: string | null;
}

export type OfferErrors = Partial<Record<keyof OfferDraft, string>>;

/** Same shape as the function's OfferConfig (checked by a contract test). */
export interface FunctionConfig {
  triggerProductIds: string[];
  offerProductIds: string[];
  discountType: DiscountType;
  discountValue: string;
  message: string;
}

export interface MetaobjectNode {
  id: string;
  handle: string;
  fields: { key: string; value: string | null }[];
  capabilities: { publishable: { status: string } | null };
}

const PRODUCT_GID = /^gid:\/\/shopify\/Product\/\d+$/;
const DISCOUNT_TYPES: DiscountType[] = ["percentage", "fixed_amount"];

// ---------------------------------------------------------------- form

export function parseOfferForm(data: FormData): { draft: OfferDraft; errors: OfferErrors } {
  const text = (name: string) => String(data.get(name) ?? "").trim();
  const errors: OfferErrors = {};

  const title = text("title");
  if (!title) errors.title = "Enter a name for this offer.";

  const heading = text("heading");
  if (!heading) errors.heading = "Enter the heading customers will see.";

  const triggerProductIds = productIds(text("triggerProductIds"));
  if (!triggerProductIds || triggerProductIds.length === 0) {
    errors.triggerProductIds = "Choose at least one trigger product.";
  }

  const offerProductIds = productIds(text("offerProductIds"));
  if (!offerProductIds || offerProductIds.length === 0) {
    errors.offerProductIds = "Choose at least one add-on.";
  } else if (offerProductIds.length > MAX_OFFER_PRODUCTS) {
    errors.offerProductIds = `Choose up to ${MAX_OFFER_PRODUCTS} add-ons.`;
  } else if (triggerProductIds?.some((id) => offerProductIds.includes(id))) {
    errors.offerProductIds = "A product can't be both a trigger and an add-on.";
  }

  const rawType = text("discountType");
  const discountType = DISCOUNT_TYPES.find((t) => t === rawType) ?? "percentage";
  if (rawType !== discountType) errors.discountType = "Choose a discount type.";

  const discountValue = text("discountValue");
  const valueError = checkDiscountValue(discountType, discountValue);
  if (valueError) errors.discountValue = valueError;

  return {
    draft: {
      title,
      heading,
      triggerProductIds: triggerProductIds ?? [],
      offerProductIds: offerProductIds ?? [],
      discountType,
      discountValue,
      showOnProduct: data.get("showOnProduct") !== null,
      showInCart: data.get("showInCart") !== null,
    },
    errors,
  };
}

function productIds(json: string): string[] | null {
  try {
    const value: unknown = JSON.parse(json || "[]");
    if (Array.isArray(value) && value.every((id) => typeof id === "string" && PRODUCT_GID.test(id))) {
      return value;
    }
  } catch {
    // fall through
  }
  return null;
}

function checkDiscountValue(type: DiscountType, value: string): string | null {
  if (!/^\d+(\.\d+)?$/.test(value)) return "Enter a number.";
  const amount = Number(value);
  if (amount <= 0) return "Enter a value above 0.";
  if (type === "percentage" && amount > 100) return "A percentage can't be above 100.";
  if (type === "fixed_amount" && !/^\d+(\.\d{1,2})?$/.test(value)) {
    return "Use at most two decimal places.";
  }
  return null;
}

// ---------------------------------------------------------------- display

/** Decimal string as stored: "15.0" for a percentage, "5.50" for an amount. */
export function normalizedValue(draft: Pick<OfferDraft, "discountType" | "discountValue">): string {
  const amount = Number(draft.discountValue);
  if (draft.discountType === "fixed_amount") return amount.toFixed(2);
  return Number.isInteger(amount) ? amount.toFixed(1) : String(amount);
}

export function discountLabel(
  draft: Pick<OfferDraft, "discountType" | "discountValue">,
  currency: string,
): string {
  const amount = Number(draft.discountValue);
  if (draft.discountType === "percentage") {
    return `${new Intl.NumberFormat("en", { maximumFractionDigits: 2 }).format(amount)}% off`;
  }
  return `${new Intl.NumberFormat("en", { style: "currency", currency }).format(amount)} off`;
}

/** Discount line text in the cart and at checkout. */
export function offerMessage(draft: OfferDraft, currency: string): string {
  return `${draft.heading}: ${discountLabel(draft, currency)}`;
}

// ---------------------------------------------------------------- discount

export function functionConfig(draft: OfferDraft, currency: string): FunctionConfig {
  return {
    triggerProductIds: draft.triggerProductIds,
    offerProductIds: draft.offerProductIds,
    discountType: draft.discountType,
    discountValue: normalizedValue(draft),
    message: offerMessage(draft, currency),
  };
}

export interface DiscountInput {
  title: string;
  discountClasses: string[];
  combinesWith: { productDiscounts: boolean; orderDiscounts: boolean; shippingDiscounts: boolean };
  metafields: { namespace: string; key: string; type: string; value: string }[];
  functionHandle?: string;
  startsAt?: string;
}

/** Input for discountAutomaticAppCreate / discountAutomaticAppUpdate. */
export function discountInput(
  draft: OfferDraft,
  currency: string,
  { create }: { create: boolean },
): DiscountInput {
  const input: DiscountInput = {
    title: `Alongside · ${draft.title}`,
    discountClasses: ["PRODUCT"],
    // Another product discount on the same add-on would change the price the
    // offer promised, so offers don't stack with product discounts.
    combinesWith: { productDiscounts: false, orderDiscounts: true, shippingDiscounts: true },
    metafields: [
      {
        namespace: CONFIG_NAMESPACE,
        key: CONFIG_KEY,
        type: "json",
        value: JSON.stringify(functionConfig(draft, currency)),
      },
    ],
  };
  if (create) {
    input.functionHandle = FUNCTION_HANDLE;
    input.startsAt = new Date().toISOString();
  }
  return input;
}

// ---------------------------------------------------------------- metaobject

export function metaobjectFields(draft: OfferDraft, discountId: string | null) {
  return [
    { key: "title", value: draft.title },
    { key: "heading", value: draft.heading },
    { key: "trigger_products", value: JSON.stringify(draft.triggerProductIds) },
    { key: "offer_products", value: JSON.stringify(draft.offerProductIds) },
    { key: "discount_type", value: draft.discountType },
    { key: "discount_value", value: normalizedValue(draft) },
    { key: "show_on_product", value: String(draft.showOnProduct) },
    { key: "show_in_cart", value: String(draft.showInCart) },
    { key: "discount_id", value: discountId ?? "" },
  ];
}

export function offerFromMetaobject(node: MetaobjectNode): Offer {
  const field = (key: string) => node.fields.find((f) => f.key === key)?.value ?? "";
  const list = (key: string): string[] => {
    try {
      const value: unknown = JSON.parse(field(key) || "[]");
      return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
    } catch {
      return [];
    }
  };
  const discountType: DiscountType = field("discount_type") === "fixed_amount" ? "fixed_amount" : "percentage";
  const rawValue = field("discount_value");
  return {
    id: node.id,
    handle: node.handle,
    enabled: node.capabilities.publishable?.status === "ACTIVE",
    discountId: field("discount_id") || null,
    title: field("title"),
    heading: field("heading"),
    triggerProductIds: list("trigger_products"),
    offerProductIds: list("offer_products"),
    discountType,
    // Shopify stores number_decimal canonically ("4.00" -> "4.0"); show it the way it was saved.
    discountValue: rawValue ? normalizedValue({ discountType, discountValue: rawValue }) : "",
    showOnProduct: field("show_on_product") === "true",
    showInCart: field("show_in_cart") === "true",
  };
}
