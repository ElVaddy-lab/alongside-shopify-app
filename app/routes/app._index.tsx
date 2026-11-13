import { useEffect } from "react";
import type { ActionFunctionArgs, HeadersFunction, LoaderFunctionArgs } from "react-router";
import { data, useFetcher, useLoaderData, useSearchParams } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";

import { authenticate } from "../shopify.server";
import { discountLabel, type Offer } from "../models/offer";
import {
  deleteOffer,
  getOffer,
  getProducts,
  getShopCurrency,
  listOffers,
  setOfferEnabled,
  type ProductSummary,
} from "../models/offers.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const [offers, currency] = await Promise.all([listOffers(admin), getShopCurrency(admin)]);
  const products = await getProducts(
    admin,
    offers.flatMap((o) => [...o.triggerProductIds, ...o.offerProductIds]),
  );
  return { offers, products, currency };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const form = await request.formData();
  const offer = await getOffer(admin, String(form.get("id")));
  const intent = String(form.get("intent"));
  if (!offer) return data({ errors: ["Offer not found"], intent }, { status: 404 });

  const errors =
    intent === "delete"
      ? await deleteOffer(admin, offer)
      : await setOfferEnabled(admin, offer, intent === "enable");
  return data({ errors, intent }, { status: errors.length ? 422 : 200 });
};

export default function Offers() {
  const { offers, products, currency } = useLoaderData<typeof loader>();
  const [params, setParams] = useSearchParams();

  useEffect(() => {
    if (params.get("saved")) {
      shopify.toast.show("Offer saved");
      params.delete("saved");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  return (
    <s-page heading="Upsell offers">
      <s-button slot="primary-action" variant="primary" href="/app/offers/new">
        Create offer
      </s-button>

      {offers.length === 0 ? (
        <s-section>
          <s-empty-state heading="Offer an add-on next to what customers already buy">
            <s-paragraph>
              Pick a trigger product, up to three add-ons and a discount. Alongside shows the
              offer in the cart and on the product page, and its discount function applies the
              price at checkout.
            </s-paragraph>
            <s-button slot="primary-action" variant="primary" href="/app/offers/new">
              Create offer
            </s-button>
          </s-empty-state>
        </s-section>
      ) : (
        <s-section padding="none" accessibilityLabel="Offers">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Offer</s-table-header>
              <s-table-header>Trigger</s-table-header>
              <s-table-header>Add-ons</s-table-header>
              <s-table-header listSlot="secondary">Discount</s-table-header>
              <s-table-header listSlot="inline">Status</s-table-header>
              <s-table-header>Actions</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {offers.map((offer) => (
                <OfferRow key={offer.id} offer={offer} products={products} currency={currency} />
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      )}
    </s-page>
  );
}

function OfferRow({
  offer,
  products,
  currency,
}: {
  offer: Offer;
  products: Record<string, ProductSummary>;
  currency: string;
}) {
  const fetcher = useFetcher<typeof action>();
  const pending = fetcher.state !== "idle" ? fetcher.formData?.get("intent") : null;
  const enabled = pending === "enable" ? true : pending === "disable" ? false : offer.enabled;
  const titles = (ids: string[]) => ids.map((id) => products[id]?.title ?? "Deleted product").join(", ");
  const editHref = `/app/offers/${encodeURIComponent(offer.id)}`;
  const deleteModalId = `delete-${offer.id.split("/").pop()}`;

  useEffect(() => {
    if (fetcher.data?.errors?.length) {
      shopify.toast.show(fetcher.data.errors.join(" "), { isError: true });
    } else if (fetcher.data?.intent === "delete") {
      shopify.toast.show("Offer deleted");
    }
  }, [fetcher.data]);

  if (pending === "delete") return null;

  return (
    <s-table-row>
      <s-table-cell>
        <s-stack gap="small-500">
          <s-link href={editHref}>{offer.title}</s-link>
          <s-text color="subdued">{offer.heading}</s-text>
        </s-stack>
      </s-table-cell>
      <s-table-cell>{titles(offer.triggerProductIds)}</s-table-cell>
      <s-table-cell>{titles(offer.offerProductIds)}</s-table-cell>
      <s-table-cell>{discountLabel(offer, currency)}</s-table-cell>
      <s-table-cell>
        <s-badge tone={enabled ? "success" : "neutral"}>{enabled ? "Active" : "Off"}</s-badge>
      </s-table-cell>
      <s-table-cell>
        <s-stack direction="inline" gap="small-200">
          <s-button
            variant="tertiary"
            loading={pending === "enable" || pending === "disable"}
            accessibilityLabel={`${enabled ? "Turn off" : "Turn on"} ${offer.title}`}
            onClick={() =>
              fetcher.submit({ id: offer.id, intent: enabled ? "disable" : "enable" }, { method: "post" })
            }
          >
            {enabled ? "Turn off" : "Turn on"}
          </s-button>
          <s-button
            variant="tertiary"
            tone="critical"
            accessibilityLabel={`Delete ${offer.title}`}
            commandFor={deleteModalId}
            command="--show"
          >
            Delete
          </s-button>
        </s-stack>
        <s-modal id={deleteModalId} heading={`Delete “${offer.title}”?`}>
          <s-paragraph>
            The offer and its automatic discount are removed from the store. This can&apos;t be
            undone.
          </s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            commandFor={deleteModalId}
            command="--hide"
            onClick={() => fetcher.submit({ id: offer.id, intent: "delete" }, { method: "post" })}
          >
            Delete offer
          </s-button>
          <s-button slot="secondary-actions" commandFor={deleteModalId} command="--hide">
            Cancel
          </s-button>
        </s-modal>
      </s-table-cell>
    </s-table-row>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
