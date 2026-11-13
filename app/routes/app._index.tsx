import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { boundary } from "@shopify/shopify-app-react-router/server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  return null;
};

// Placeholder until the offer list is built (PLAN.md, stage 6).
export default function Offers() {
  return (
    <s-page heading="Upsell offers">
      <s-section>
        <s-paragraph>
          No offers yet. Offers pair a trigger product with up to three
          add-ons and a discount that is applied at checkout.
        </s-paragraph>
      </s-section>
    </s-page>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
