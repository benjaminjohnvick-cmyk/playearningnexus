import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getNumber } from "../../sdk/settings.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { db } from "../../sdk/db.ts";
import { PLATFORM_SELLER_ID } from "../../sdk/catalog.ts";
import { welcomeDiscountFor, redeemWelcomeCredit } from "../../sdk/welcome-credit.ts";

// purchaseMarketplaceListing (authenticated buyer) — buy a marketplace item with POINTS (on-site,
// closed-loop) or by CARD (adds the platform markup). Behavior branches on listing.source:
//   • user            — a member's own item. Seller is credited; seller ships (existing flow).
//   • platform_catalog — an original platform product. Platform is the seller (no user credit);
//                        routed to the AI order-fulfillment lifecycle.
//   • affiliate       — a real branded product from an AUTHORIZED retailer feed. We do NOT charge on
//                        our side; we return the affiliate link and the retailer fulfills.
//   Body: { listing_id, payment_method: "points" | "card", shipping_address? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { listing_id, payment_method, shipping_address, acknowledged_over_limit } = await req.json().catch(() => ({}));

    const listing = await base44.asServiceRole.entities.MarketplaceListing.filter({ id: listing_id }).then((r: any) => r[0]);
    if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });
    if (listing.status !== "active") return Response.json({ error: `Listing is ${listing.status}` }, { status: 409 });

    const source = listing.source || "user";
    const isPlatform = source === "platform_catalog" || listing.seller_id === PLATFORM_SELLER_ID;

    // Affiliate listings: no on-platform charge — hand back the authorized affiliate link; the retailer
    // sells and fulfills. (This keeps real branded goods legal without us taking money for them.)
    if (source === "affiliate") {
      const url = listing.affiliate_url || listing.external_url || "";
      if (!url) return Response.json({ error: "This affiliate listing has no link configured." }, { status: 409 });
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id, type: "marketplace_affiliate_click",
        title: "↗️ Continue to retailer", message: `"${listing.title}" is fulfilled by ${listing.source_label || "the retailer"}.`, is_read: false,
      }).catch(() => null);
      return Response.json({ success: true, affiliate: true, redirect_url: url, disclosure: "Affiliate link — we may earn a commission." });
    }

    if (!listing_id || !["points", "card"].includes(payment_method)) {
      return Response.json({ error: 'listing_id and payment_method ("points"|"card") required' }, { status: 400 });
    }
    if (listing.seller_id === user.id) return Response.json({ error: "You can't buy your own listing" }, { status: 400 });

    // Validate a REAL seller before taking money (member listings only). Platform catalog has no User
    // row — the platform is the seller — so we skip the seller lookup for it.
    let seller: any = null;
    if (!isPlatform) {
      [seller] = await base44.asServiceRole.entities.User.filter({ id: listing.seller_id });
      if (!seller) return Response.json({ error: "This seller is no longer available." }, { status: 409 });
    }

    // Pre-flight the payment path (no charge yet) so we don't claim a listing we can't pay for.
    let charged = { method: payment_method, points: 0, usd: 0, markup: 0, welcome_discount_usd: 0 };
    let pointsPrice = 0;          // list price in points
    let effectivePoints = 0;      // what the buyer actually pays after any welcome discount
    let welcomeDiscountUsd = 0;   // platform-catalog only; funded by platform margin
    if (payment_method === "points") {
      pointsPrice = Number(listing.price_points) || 0;
      if (pointsPrice <= 0) return Response.json({ error: "This item isn't available for points" }, { status: 400 });
      effectivePoints = pointsPrice;
      // Welcome rewards: apply ONLY to platform-catalog items (platform is the seller, so the discount
      // comes off platform margin — never shorts a member seller). The pool is in USD, but price_points
      // is in LOCAL-currency cents, so cap the discount on the item's TRUE USD value and convert back to
      // points via points-per-USD (= fx×100). This keeps the $1,460 pool denominated correctly in USD.
      const usd = Number(listing.price_usd) || 0;
      if (isPlatform && usd > 0) {
        welcomeDiscountUsd = await welcomeDiscountFor(user.id, usd);
        const pointsPerUsd = pointsPrice / usd;
        effectivePoints = Math.max(0, pointsPrice - Math.round(welcomeDiscountUsd * pointsPerUsd));
      }
      if ((Number(user.points) || 0) < effectivePoints) return Response.json({ error: "Insufficient points", required: effectivePoints, balance: Number(user.points) || 0 }, { status: 402 });
    } else {
      if (!(await isEnabled("card_charging"))) {
        return Response.json({ blocked: true, reason: "card_payments_disabled", message: "Card payments aren't enabled yet. Use points, or contact support." }, { status: 403 });
      }
      const base = Number(listing.price_usd) || 0;
      if (base <= 0) return Response.json({ error: "This item isn't available for card purchase" }, { status: 400 });
      const markup = await getNumber("STORE_MARKUP", 0.10);
      charged.usd = Math.round(base * (1 + markup) * 100) / 100;
      charged.markup = Math.round(base * markup * 100) / 100;
      // NOTE: actual card capture is handled by the payment processor path; here we record the order.
    }

    // Affordability warning: if the total the buyer would owe exceeds the reasonable-annual-earnings
    // threshold (default $1,460 — the same figure as the welcome-rewards ceiling), tell them it's more
    // than they can realistically earn/pay back in a year. This is a WARNING, not a hard block: the
    // client re-submits with acknowledged_over_limit:true to proceed.
    const orderTotalUsd = payment_method === "card" ? charged.usd : (Number(listing.price_usd) || 0);
    const affordLimit = await getNumber("PHYSICAL_AFFORDABILITY_LIMIT_USD", 1460);
    if (affordLimit > 0 && orderTotalUsd > affordLimit && !acknowledged_over_limit) {
      return Response.json({
        affordability_warning: true,
        total_usd: orderTotalUsd,
        limit_usd: affordLimit,
        message: `This order is $${orderTotalUsd.toFixed(2)} — more than the ~$${affordLimit.toLocaleString()} a member can reasonably earn or pay back in a year. You can still proceed, or choose a lower-cost option, financing (Affirm), or layaway.`,
      });
    }

    // Atomically CLAIM the listing (active → sold). If another buyer won the race, we bail before
    // charging — this closes the double-sell window.
    const claimed = await db.updateIf("MarketplaceListing", listing.id,
      { status: "sold", sold_to: user.id, sold_at: new Date().toISOString() },
      { field: "status", equals: "active" });
    if (!claimed) return Response.json({ error: "Sorry — this item was just sold.", status: 409 }, { status: 409 });

    // Now charge (we own the claim). On points: re-read the buyer for a fresh balance.
    if (payment_method === "points") {
      const fresh = (await base44.asServiceRole.entities.User.filter({ id: user.id }))[0] || user;
      if ((Number(fresh.points) || 0) < effectivePoints) {
        // Buyer spent their points elsewhere between pre-flight and claim → release the listing.
        await db.updateIf("MarketplaceListing", listing.id, { status: "active", sold_to: null }, { field: "status", equals: "sold" }).catch(() => null);
        return Response.json({ error: "Insufficient points", required: effectivePoints }, { status: 402 });
      }
      await base44.asServiceRole.entities.User.update(user.id, { points: (Number(fresh.points) || 0) - effectivePoints });
      // Credit the seller only when there's a real member seller. Platform-catalog points are platform
      // revenue (closed-loop), so there's no user to credit. Seller gets FULL list price; the welcome
      // discount is absorbed by the platform (and only applies to platform items anyway).
      if (!isPlatform && seller) {
        await base44.asServiceRole.entities.User.update(seller.id, { points: (Number(seller.points) || 0) + pointsPrice });
      }
      // Deduct the used welcome credit from the buyer's pool (platform items only).
      if (welcomeDiscountUsd > 0) {
        await redeemWelcomeCredit(user.id, welcomeDiscountUsd);
        charged.welcome_discount_usd = welcomeDiscountUsd;
      }
      charged.points = effectivePoints;
    }

    // Points are captured above (real closed-loop debit). CARD is NOT captured in this handler — the
    // processor path does that — so a card order opens as awaiting_payment and does NOT trigger
    // fulfillment or seller funds-release until payment is confirmed. This prevents a "sold + funds
    // released but never paid" giveaway if card_charging is switched on before capture is wired.
    const paidNow = payment_method === "points";
    const orderStatus = paidNow ? "awaiting_shipment" : "awaiting_payment";
    const fulfillment_type = listing.fulfillment_mode === "pickup" ? "local_pickup" : (isPlatform ? "platform_ai" : "seller_ship");
    const order = await base44.asServiceRole.entities.Order.create({
      user_id: user.id,
      seller_id: listing.seller_id,
      listing_id: listing.id,
      item_name: listing.title,
      amount: charged.usd || null,
      points_spent: charged.points || null,
      payment_method,
      payment_captured: paidNow,
      markup_applied: charged.markup || 0,
      fulfillment_type,
      source,
      shipping_address: shipping_address || null,
      status: orderStatus,
      created_at: new Date().toISOString(),
    });

    // Notify the buyer always; notify a member seller only once payment is captured.
    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id, type: "marketplace_purchase",
      title: paidNow ? "🛍️ Purchase confirmed" : "🛍️ Order started",
      message: paidNow
        ? `You bought "${listing.title}".${isPlatform ? " It's being prepared for fulfillment." : " The seller will ship it soon."}`
        : `Your order for "${listing.title}" is awaiting card payment. It'll be fulfilled once payment completes.`,
      is_read: false,
    }).catch(() => null);
    if (!isPlatform && paidNow) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: listing.seller_id, type: "marketplace_sale",
        title: "💰 Your item sold!", message: `"${listing.title}" sold. Please ship it to complete the sale and release your funds.`, is_read: false,
      }).catch(() => null);
    }

    // Kick the appropriate fulfillment engine ONLY when payment is actually captured (points).
    if (paidNow) {
      const fulfillFn = isPlatform ? "aiOrderFulfillment" : "autoOrderFulfillmentAndFundsRelease";
      base44.asServiceRole.functions.invoke(fulfillFn, { order_id: (order as any).id }).catch(() => null);
    }

    return Response.json({ success: true, order_id: (order as any).id, charged, payment_captured: paidNow });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
