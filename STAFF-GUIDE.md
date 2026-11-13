# Alongside — staff guide

How to offer add-ons with a discount: create an offer, change it, turn it off.

You need access to **Apps** in the Shopify admin. Open **Apps → Alongside**. The first page is the list of offers.

## What an offer is

An offer has three parts:

- **Trigger products** — what the customer buys (for example, a backpack).
- **Add-ons** — up to 3 products you offer next to it (for example, a rain cover).
- **Discount** — a percentage or a fixed amount off each add-on.

Customers see the add-ons on the trigger product page and in the cart. The discount is applied in the cart and at checkout, only when a trigger product is in the cart.

One trigger in the cart gives a discount on one unit of each add-on. Two triggers — on two units, and so on.

## Create an offer

1. In **Alongside**, click **Create offer**.
2. **Internal name** — a name for you and your team, for example "Backpack add-ons". Customers don't see it.
3. **Heading shown to customers** — a short line, for example "Complete your setup". It appears above the add-ons and in the discount line at checkout ("Complete your setup: 15% off").
4. **Trigger products** — click **Choose products** and pick one or more products. To change the selection later, click **Change**; to remove one product, click the **×** next to it.
5. **Add-ons** — choose 1 to 3 products. A product can't be both a trigger and an add-on in the same offer.
6. **Discount type** — **Percentage** or **Fixed amount off each add-on**.
7. **Discount value** — for example `15` (%) or `5` (in the store currency). It must be above 0; a percentage can't be above 100.
8. **Where to show** — **In the cart** and / or **On the trigger product page**.
9. Click **Save offer**. You return to the list and see "Offer saved". The offer is **Active** right away.

If something is missing, the field shows what to fix. Nothing is saved until all fields are correct.

## Check it in the store

1. Open a trigger product in the online store. Where the Alongside block is placed, you see the heading and the add-ons with two prices: the regular price and the offer price ("15% off with …").
2. Add the trigger product to the cart, then add an add-on. In the cart the add-on shows the lower price.
3. Go to checkout: the discount line shows your heading and the discount.

Don't place real orders to test. You can stop at the checkout page.

## Change the discount or the products

1. In the list, click the offer name.
2. Change what you need: the heading, products, discount type or value, where to show.
3. Click **Save offer** (or **Save** in the bar at the top of the page). To undo your edits before saving, click **Discard** in the same bar.

Changes are live in the store and at checkout as soon as you save.

## Turn an offer off (and on again)

- In the list, click **Turn off** next to the offer. Its status changes to **Off**: the add-ons disappear from the store, and the discount stops at checkout.
- Click **Turn on** to start it again with the same settings.

Use this for a short break, for example when an add-on is out of stock for a while or a sale with other discounts is running.

## Delete an offer

Click **Delete** next to the offer, then **Delete offer** in the window that opens. The offer and its discount are removed. This can't be undone — if you may need the offer again, use **Turn off** instead.

## Good to know

- **Change offers only in Alongside.** Each offer also has an automatic discount in **Discounts**, named "Alongside · *internal name*". Don't edit or delete it there — Alongside keeps it in sync with the offer. If it was deleted by mistake, delete the offer in Alongside and create it again.
- **Sold-out add-ons** are hidden from the offer automatically. When all add-ons are sold out, the offer is not shown.
- **An add-on already in the cart** is not offered again in the cart.
- **Other discounts:** if another product discount also applies to the same add-on, the customer gets only one of them. Order and shipping discounts can apply together with the offer if they are set to combine with product discounts.
- **Limits:** up to 3 add-ons per offer. Shopify allows up to 25 active automatic app discounts per store, and Alongside shows up to 50 offers.

## The offer doesn't show in the store

Check in this order:

1. The offer is **Active** in the list.
2. **Where to show** has the right box checked (**In the cart** / **On the trigger product page**).
3. The theme has Alongside switched on. In **Online Store → Themes → Customize**:
   - cart: **App embeds** → **Add-on offers in cart** is on;
   - product page: open the product template; the **Add-on offers** block is added to it.

   Ask your developer if you are not sure how to do this.
4. For the cart: a trigger product is in the cart, and the add-on is not.
5. At least one add-on is in stock and available in the online store.

If the add-ons show but the price at checkout is full: check that a trigger product is in the cart, and that the "Alongside · …" discount in **Discounts** is active.
