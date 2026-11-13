import { useState } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, redirect, useActionData, useLoaderData, useNavigation, useSubmit } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { ProductPicker } from "../components/ProductPicker";
import { parseOfferForm, type DiscountType, type OfferErrors } from "../models/offer";
import {
  createOffer,
  getOffer,
  getProducts,
  getShopCurrency,
  updateOffer,
} from "../models/offers.server";

const NEW = "new";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const currency = await getShopCurrency(admin);

  if (params.id === NEW) {
    return { offer: null, products: {}, currency };
  }
  const offer = await getOffer(admin, decodeURIComponent(params.id!));
  if (!offer) {
    throw new Response("Offer not found", { status: 404 });
  }
  const products = await getProducts(admin, [...offer.triggerProductIds, ...offer.offerProductIds]);
  return { offer, products, currency };
};

export const action = async ({ request, params }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { draft, errors } = parseOfferForm(await request.formData());
  if (Object.keys(errors).length) {
    return data({ errors, saveErrors: [] as string[] }, { status: 422 });
  }

  const currency = await getShopCurrency(admin);
  let result;
  if (params.id === NEW) {
    result = await createOffer(admin, draft, currency);
  } else {
    const offer = await getOffer(admin, decodeURIComponent(params.id!));
    if (!offer) throw new Response("Offer not found", { status: 404 });
    result = await updateOffer(admin, offer, draft, currency);
  }
  if (!result.ok) {
    return data({ errors: {} as OfferErrors, saveErrors: result.errors }, { status: 422 });
  }
  return redirect("/app?saved=1");
};

export default function OfferPage() {
  const { offer, products, currency } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const submit = useSubmit();
  const errors: OfferErrors = actionData?.errors ?? {};
  const saving = navigation.state === "submitting";

  const [discountType, setDiscountType] = useState<DiscountType>(offer?.discountType ?? "percentage");
  const pick = (ids: string[]) => ids.map((id) => products[id as keyof typeof products]).filter(Boolean);

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submit(event.currentTarget, { method: "post" });
  }

  return (
    <s-page heading={offer ? offer.title : "New offer"} inlineSize="small">
      <s-link slot="breadcrumb-actions" href="/app">
        Offers
      </s-link>
      <form data-save-bar method="post" onSubmit={onSubmit}>
        <s-stack gap="base">
          {actionData?.saveErrors?.length ? (
            <s-banner tone="critical" heading="The offer was not saved">
              <s-unordered-list>
                {actionData.saveErrors.map((message) => (
                  <s-list-item key={message}>{message}</s-list-item>
                ))}
              </s-unordered-list>
            </s-banner>
          ) : null}

          <s-section heading="Offer">
            <s-stack gap="base">
              <s-text-field
                name="title"
                label="Internal name"
                details="Only you see this, in the offer list and in Discounts."
                defaultValue={offer?.title ?? ""}
                error={errors.title}
                required
              />
              <s-text-field
                name="heading"
                label="Heading shown to customers"
                details="Shown above the add-ons and in the discount line at checkout."
                placeholder="Complete your setup"
                defaultValue={offer?.heading ?? ""}
                error={errors.heading}
                maxLength={60}
                required
              />
            </s-stack>
          </s-section>

          <s-section heading="Products">
            <s-stack gap="large">
              <ProductPicker
                name="triggerProductIds"
                label="Trigger products"
                details="The offer appears when one of these is in the cart or on the product page."
                initial={pick(offer?.triggerProductIds ?? [])}
                error={errors.triggerProductIds}
              />
              <s-divider />
              <ProductPicker
                name="offerProductIds"
                label="Add-ons"
                details="Up to 3 products offered with a discount."
                max={3}
                initial={pick(offer?.offerProductIds ?? [])}
                error={errors.offerProductIds}
              />
            </s-stack>
          </s-section>

          <s-section heading="Discount">
            <s-stack gap="base">
              <s-select
                name="discountType"
                label="Discount type"
                value={discountType}
                error={errors.discountType}
                onChange={(e) => setDiscountType(e.currentTarget.value as DiscountType)}
              >
                <s-option value="percentage">Percentage</s-option>
                <s-option value="fixed_amount">Fixed amount off each add-on</s-option>
              </s-select>
              <s-number-field
                name="discountValue"
                label="Discount value"
                defaultValue={offer?.discountValue ?? ""}
                min={0}
                max={discountType === "percentage" ? 100 : undefined}
                step={discountType === "percentage" ? 1 : 0.01}
                suffix={discountType === "percentage" ? "%" : currency}
                details="Applied by the Alongside discount function in the cart and at checkout. One add-on unit per trigger unit."
                error={errors.discountValue}
                required
              />
            </s-stack>
          </s-section>

          <s-section heading="Where to show">
            <s-stack gap="small">
              <s-checkbox
                name="showInCart"
                label="In the cart"
                details="Needs the Alongside app embed turned on in the theme editor."
                defaultChecked={offer?.showInCart ?? true}
              />
              <s-checkbox
                name="showOnProduct"
                label="On the trigger product page"
                details="Needs the Alongside block added to the product template."
                defaultChecked={offer?.showOnProduct ?? true}
              />
            </s-stack>
          </s-section>

          <s-stack direction="inline" justifyContent="end">
            <s-button type="submit" variant="primary" loading={saving}>
              Save offer
            </s-button>
          </s-stack>
        </s-stack>
      </form>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
