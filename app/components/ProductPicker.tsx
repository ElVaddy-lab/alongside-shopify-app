import { useEffect, useRef, useState } from "react";

import type { ProductSummary } from "../models/offers.server";

interface ProductPickerProps {
  /** Form field name; the value is a JSON array of product GIDs. */
  name: string;
  label: string;
  details: string;
  /** Upper limit for the picker; undefined = no limit. */
  max?: number;
  initial: ProductSummary[];
  error?: string;
}

/**
 * Product list chosen with the App Bridge resource picker.
 * The selection lives in a hidden input so it is submitted with the native
 * form and the contextual save bar notices changes.
 */
export function ProductPicker({ name, label, details, max, initial, error }: ProductPickerProps) {
  const [products, setProducts] = useState<ProductSummary[]>(initial);
  const inputRef = useRef<HTMLInputElement>(null);
  const isFirstRender = useRef(true);
  // Controlled: for type="hidden" the value and the default value are the same
  // attribute, so an uncontrolled defaultValue would be re-applied by React on
  // the next render (e.g. after a failed save) and silently empty the list.
  const value = JSON.stringify(products.map((p) => p.id));

  // Tell the contextual save bar that the form changed.
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    inputRef.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [value]);

  // Discard on the save bar resets the native form; restore the saved list too.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => setProducts(initial);
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [initial]);

  async function choose() {
    const selected = await shopify.resourcePicker({
      type: "product",
      action: "select",
      multiple: max ?? true,
      selectionIds: products.map((p) => ({ id: p.id })),
      filter: { variants: false },
    });
    if (!selected) return; // cancelled
    setProducts(
      selected.map((p) => ({
        id: p.id,
        title: p.title,
        imageUrl: p.images?.[0]?.originalSrc ?? null,
        imageAlt: p.images?.[0]?.altText ?? null,
      })),
    );
  }

  return (
    <s-stack gap="small-200">
      <s-stack direction="inline" gap="base" justifyContent="space-between" alignItems="center">
        <s-heading>{label}</s-heading>
        <s-button onClick={choose} accessibilityLabel={`Choose ${label.toLowerCase()}`}>
          {products.length ? "Change" : "Choose products"}
        </s-button>
      </s-stack>
      <s-text color="subdued">{details}</s-text>
      <input ref={inputRef} type="hidden" name={name} value={value} readOnly />
      {products.length > 0 && (
        <s-stack gap="small-200">
          {products.map((product) => (
            <s-stack key={product.id} direction="inline" gap="base" alignItems="center">
              <s-thumbnail
                size="small"
                src={product.imageUrl ?? undefined}
                alt={product.imageAlt ?? product.title}
              />
              <s-text>{product.title}</s-text>
              <s-button
                variant="tertiary"
                icon="x"
                accessibilityLabel={`Remove ${product.title}`}
                onClick={() => setProducts(products.filter((p) => p.id !== product.id))}
              />
            </s-stack>
          ))}
        </s-stack>
      )}
      {error && <s-text tone="critical">{error}</s-text>}
    </s-stack>
  );
}
