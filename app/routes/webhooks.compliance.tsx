import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// Mandatory privacy compliance webhooks:
// customers/data_request, customers/redact, shop/redact.
// Alongside stores no customer data (offers live in Shopify metaobjects and
// discounts; the database holds only the shop's session), so there is nothing
// to export or erase. The request is verified (HMAC) and acknowledged.
export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, topic } = await authenticate.webhook(request);

  console.log(`Received ${topic} compliance webhook for ${shop}`);

  return new Response();
};
