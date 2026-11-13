import type { AdminApiContext } from "@shopify/shopify-app-react-router/server";

import {
  OFFER_TYPE,
  discountInput,
  metaobjectFields,
  offerFromMetaobject,
  type MetaobjectNode,
  type Offer,
  type OfferDraft,
} from "./offer";

type Admin = AdminApiContext;

interface UserError {
  field?: string[] | null;
  message: string;
}

export interface ProductSummary {
  id: string;
  title: string;
  imageUrl: string | null;
  imageAlt: string | null;
}

export type SaveResult = { ok: true; offer: Offer } | { ok: false; errors: string[] };

async function gql<T>(admin: Admin, query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await admin.graphql(query, { variables });
  const json = (await response.json()) as { data?: T; errors?: unknown };
  if (!json.data) {
    throw new Error(`Admin API error: ${JSON.stringify(json.errors)}`);
  }
  return json.data;
}

const messages = (errors: UserError[] | undefined) => (errors ?? []).map((e) => e.message);

const METAOBJECT_FIELDS = `#graphql
  fragment OfferMetaobject on Metaobject {
    id
    handle
    updatedAt
    capabilities {
      publishable {
        status
      }
    }
    fields {
      key
      value
    }
  }
`;

export async function getShopCurrency(admin: Admin): Promise<string> {
  const data = await gql<{ shop: { currencyCode: string } }>(
    admin,
    `#graphql
      query ShopCurrency {
        shop {
          currencyCode
        }
      }`,
  );
  return data.shop.currencyCode;
}

export async function listOffers(admin: Admin): Promise<Offer[]> {
  const data = await gql<{ metaobjects: { nodes: MetaobjectNode[] } }>(
    admin,
    `#graphql
      ${METAOBJECT_FIELDS}
      query Offers($type: String!) {
        metaobjects(type: $type, first: 50, sortKey: "updated_at", reverse: true) {
          nodes {
            ...OfferMetaobject
          }
        }
      }`,
    { type: OFFER_TYPE },
  );
  return data.metaobjects.nodes.map(offerFromMetaobject);
}

export async function getOffer(admin: Admin, id: string): Promise<Offer | null> {
  const data = await gql<{ metaobject: MetaobjectNode | null }>(
    admin,
    `#graphql
      ${METAOBJECT_FIELDS}
      query Offer($id: ID!) {
        metaobject(id: $id) {
          ...OfferMetaobject
        }
      }`,
    { id },
  );
  return data.metaobject ? offerFromMetaobject(data.metaobject) : null;
}

/** Titles and images for the products referenced by offers. */
export async function getProducts(admin: Admin, ids: string[]): Promise<Record<string, ProductSummary>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return {};
  const data = await gql<{
    nodes: Array<{
      id: string;
      title: string;
      featuredMedia: { preview: { image: { url: string; altText: string | null } | null } | null } | null;
    } | null>;
  }>(
    admin,
    `#graphql
      query OfferProducts($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
            featuredMedia {
              preview {
                image {
                  url(transform: { maxWidth: 120, maxHeight: 120 })
                  altText
                }
              }
            }
          }
        }
      }`,
    { ids: unique },
  );
  const byId: Record<string, ProductSummary> = {};
  for (const node of data.nodes) {
    if (!node?.id) continue;
    byId[node.id] = {
      id: node.id,
      title: node.title,
      imageUrl: node.featuredMedia?.preview?.image?.url ?? null,
      imageAlt: node.featuredMedia?.preview?.image?.altText ?? null,
    };
  }
  return byId;
}

/**
 * Creates the automatic discount first (its ID goes into the metaobject),
 * then the metaobject. If the metaobject fails, the discount is removed again
 * so no orphan discount is left in the store.
 */
export async function createOffer(admin: Admin, draft: OfferDraft, currency: string): Promise<SaveResult> {
  const created = await gql<{
    discountAutomaticAppCreate: {
      automaticAppDiscount: { discountId: string } | null;
      userErrors: UserError[];
    };
  }>(
    admin,
    `#graphql
      mutation CreateOfferDiscount($discount: DiscountAutomaticAppInput!) {
        discountAutomaticAppCreate(automaticAppDiscount: $discount) {
          automaticAppDiscount {
            discountId
          }
          userErrors {
            field
            message
          }
        }
      }`,
    { discount: discountInput(draft, currency, { create: true }) },
  );
  const discountId = created.discountAutomaticAppCreate.automaticAppDiscount?.discountId;
  if (!discountId) {
    return { ok: false, errors: messages(created.discountAutomaticAppCreate.userErrors) };
  }

  const saved = await gql<{
    metaobjectCreate: { metaobject: MetaobjectNode | null; userErrors: UserError[] };
  }>(
    admin,
    `#graphql
      ${METAOBJECT_FIELDS}
      mutation CreateOffer($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            ...OfferMetaobject
          }
          userErrors {
            field
            message
          }
        }
      }`,
    {
      metaobject: {
        type: OFFER_TYPE,
        fields: metaobjectFields(draft, discountId),
        capabilities: { publishable: { status: "ACTIVE" } },
      },
    },
  );
  if (!saved.metaobjectCreate.metaobject) {
    await deleteDiscount(admin, discountId);
    return { ok: false, errors: messages(saved.metaobjectCreate.userErrors) };
  }
  return { ok: true, offer: offerFromMetaobject(saved.metaobjectCreate.metaobject) };
}

export async function updateOffer(
  admin: Admin,
  offer: Offer,
  draft: OfferDraft,
  currency: string,
): Promise<SaveResult> {
  if (offer.discountId) {
    const updated = await gql<{ discountAutomaticAppUpdate: { userErrors: UserError[] } }>(
      admin,
      `#graphql
        mutation UpdateOfferDiscount($id: ID!, $discount: DiscountAutomaticAppInput!) {
          discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $discount) {
            userErrors {
              field
              message
            }
          }
        }`,
      { id: offer.discountId, discount: discountInput(draft, currency, { create: false }) },
    );
    const errors = messages(updated.discountAutomaticAppUpdate.userErrors);
    if (errors.length) return { ok: false, errors };
  }

  const saved = await gql<{
    metaobjectUpdate: { metaobject: MetaobjectNode | null; userErrors: UserError[] };
  }>(
    admin,
    `#graphql
      ${METAOBJECT_FIELDS}
      mutation UpdateOffer($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject {
            ...OfferMetaobject
          }
          userErrors {
            field
            message
          }
        }
      }`,
    { id: offer.id, metaobject: { fields: metaobjectFields(draft, offer.discountId) } },
  );
  if (!saved.metaobjectUpdate.metaobject) {
    return { ok: false, errors: messages(saved.metaobjectUpdate.userErrors) };
  }
  return { ok: true, offer: offerFromMetaobject(saved.metaobjectUpdate.metaobject) };
}

/** On = published metaobject + active discount; off = draft + deactivated discount. */
export async function setOfferEnabled(admin: Admin, offer: Offer, enabled: boolean): Promise<string[]> {
  const errors: string[] = [];
  if (offer.discountId) {
    const mutation = enabled
      ? `#graphql
          mutation ActivateOfferDiscount($id: ID!) {
            discountAutomaticActivate(id: $id) {
              userErrors {
                field
                message
              }
            }
          }`
      : `#graphql
          mutation DeactivateOfferDiscount($id: ID!) {
            discountAutomaticDeactivate(id: $id) {
              userErrors {
                field
                message
              }
            }
          }`;
    const data = await gql<Record<string, { userErrors: UserError[] }>>(admin, mutation, {
      id: offer.discountId,
    });
    errors.push(...messages(Object.values(data)[0]?.userErrors));
  }
  const data = await gql<{ metaobjectUpdate: { userErrors: UserError[] } }>(
    admin,
    `#graphql
      mutation SetOfferStatus($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          userErrors {
            field
            message
          }
        }
      }`,
    {
      id: offer.id,
      metaobject: { capabilities: { publishable: { status: enabled ? "ACTIVE" : "DRAFT" } } },
    },
  );
  errors.push(...messages(data.metaobjectUpdate.userErrors));
  return errors;
}

export async function deleteOffer(admin: Admin, offer: Offer): Promise<string[]> {
  const errors = offer.discountId ? await deleteDiscount(admin, offer.discountId) : [];
  const data = await gql<{ metaobjectDelete: { userErrors: UserError[] } }>(
    admin,
    `#graphql
      mutation DeleteOffer($id: ID!) {
        metaobjectDelete(id: $id) {
          userErrors {
            field
            message
          }
        }
      }`,
    { id: offer.id },
  );
  return [...errors, ...messages(data.metaobjectDelete.userErrors)];
}

async function deleteDiscount(admin: Admin, id: string): Promise<string[]> {
  const data = await gql<{ discountAutomaticDelete: { userErrors: UserError[] } }>(
    admin,
    `#graphql
      mutation DeleteOfferDiscount($id: ID!) {
        discountAutomaticDelete(id: $id) {
          userErrors {
            field
            message
          }
        }
      }`,
    { id },
  );
  // Already gone (e.g. removed in Discounts, or by a reinstall) is fine when deleting.
  return messages(data.discountAutomaticDelete.userErrors).filter((m) => !/does not exist/i.test(m));
}
