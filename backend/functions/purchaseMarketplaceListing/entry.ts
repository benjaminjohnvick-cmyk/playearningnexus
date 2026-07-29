import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getNumber, getBool } from "../../sdk/settings.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { db } from "../../sdk/db.ts";
import { PLATFORM_SELLER_ID, isDigitalCategory } from "../../sdk/catalog.ts";
import { welcomeDiscountFor, redeemWelcomeCredit } from "../../sdk/welcome-credit.ts";
import { purchaseGate } from "../../sdk/household.ts";
import { recordPurchaseSignal } from "../../sdk/purchase-signal.ts";
import { quoteDiscount, fundDiscountFromPool } from "../../sdk/loyalty.ts";

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
    let charged = { method: payment_method, points: 0, usd: 0, markup: 0, welcome_discount_usd: 0, loyalty_discount_usd: 0 };

    // LOYALTY MEMBER DISCOUNT — priced here, POOL-FUNDED on commit. Applies to first-party (platform)
    // items so member-seller payouts stay whole. The discount is funded from the member's own
    // generated-revenue pool (see sdk/loyalty.ts), NOT from the store markup — so store margin is
    // untouched. quoteDiscount() returns 0 unless the member completed today's steps and has pool
    // headroom under the back-end annual cap. The pool is decremented only after a successful sale
    // (mirrors the welcome-credit redeem-on-commit pattern).
    let loyaltyDiscountUsd = 0;
    let loyaltyMemberId: string | null = null;
    if (isPlatform && (await isEnabled("loyalty_program"))) {
      const mem = ((await db.filter("PremiumPPCMembership", { user_id: user.id }, "-created_date", 1).catch(() => [])) as Record<string, unknown>[])[0] || null;
      const q = quoteDiscount(mem, Number(listing.price_usd) || 0);
      if (q > 0 && mem?.id) { loyaltyDiscountUsd = q; loyaltyMemberId = String(mem.id); }
    }
    let pointsPrice = 0;          // list price in points
    let effectivePoints = 0;      // what the buyer actually pays after any welcome discount
    let welcomeDiscountUsd = 0;   // platform-catalog only; funded by platform margin
    if (payment_method === "points") {
      const basePoints = Number(listing.price_points) || 0;
      if (basePoints <= 0) return Response.json({ error: "This item isn't available for points" }, { status: 400 });
      pointsPrice = basePoints;   // list price — what a member seller is credited (unchanged by the markup)
      // Apply the SAME markup to points/survey purchases as to card, so the platform earns margin on
      // every sale regardless of payment method.
      const markup = await getNumber("STORE_MARKUP", 0.10);
      const grossPoints = Math.round(basePoints * (1 + markup));
      effectivePoints = grossPoints;
      // Welcome rewards: apply ONLY to platform-catalog items (platform is the seller). The pool is in
      // USD but price_points is LOCAL cents, so cap on the item's TRUE USD value and convert back.
      const usd = Number(listing.price_usd) || 0;
      if (isPlatform && usd > 0) {
        let wd = await welcomeDiscountFor(user.id, usd);
        // Margin-positive: the MARKUP funds the welcome credit — cap the discount at the markup so the
        // buyer's net never drops below the base list price (PROMO_FUNDED_BY_MARKUP, default on).
        if (await getBool("PROMO_FUNDED_BY_MARKUP", true)) wd = Math.min(wd, usd * markup);
        welcomeDiscountUsd = Math.round(wd * 100) / 100;
        const pointsPerUsd = basePoints / usd;
        effectivePoints = Math.max(0, grossPoints - Math.round(welcomeDiscountUsd * pointsPerUsd));
      }
      // Member discount (pool-funded) reduces the points charged too, converted at the item's USD rate.
      if (loyaltyDiscountUsd > 0 && usd > 0) {
        effectivePoints = Math.max(0, effectivePoints - Math.round(loyaltyDiscountUsd * (basePoints / usd)));
      }
      charged.markup = Math.round(basePoints * markup);   // markup recorded (in points)
      if ((Number(user.points) || 0) < effectivePoints) return Response.json({ error: "Insufficient points", required: effectivePoints, balance: Number(user.points) || 0 }, { status: 402 });
    } else {
      if (!(await isEnabled("card_charging"))) {
        return Response.json({ blocked: true, reason: "card_payments_disabled", message: "Card payments aren't enabled yet. Use points, or contact support." }, { status: 403 });
      }
      const base = Number(listing.price_usd) || 0;
      if (base <= 0) return Response.json({ error: "This item isn't available for card purchase" }, { status: 400 });
      const markup = await getNumber("STORE_MARKUP", 0.10);
      const gross = base * (1 + markup);
      // Welcome credit applies to card too (platform items), FUNDED BY the markup and capped so the
      // charge never drops below the base price — always margin-positive.
      let wd = 0;
      if (isPlatform && base > 0) {
        wd = await welcomeDiscountFor(user.id, base);
        if (await getBool("PROMO_FUNDED_BY_MARKUP", true)) wd = Math.min(wd, base * markup);
      }
      charged.usd = Math.round(Math.max(base, gross - wd) * 100) / 100;
      // Member discount (pool-funded) comes off the card charge too. Funded from the member's pool at
      // capture — never below 0, and never touching the store margin.
      if (loyaltyDiscountUsd > 0) charged.usd = Math.round(Math.max(0, charged.usd - loyaltyDiscountUsd) * 100) / 100;
      charged.markup = Math.round(base * markup * 100) / 100;
      charged.welcome_discount_usd = Math.round(wd * 100) / 100;
      // NOTE: card capture is external; welcomeDiscountUsd stays 0 here so the promo pool isn't redeemed
      // before payment is confirmed (no premature/duplicate redemption). The pending discount rides on
      // the order and is redeemed at capture.
    }

    // Affordability warning: if the total the buyer would owe exceeds the reasonable-annual-earnings
    // threshold (default $1,460 — the same figure as the welcome-rewards ceiling), tell them it's more
    // than they can realistically earn/pay back in a year. This is a WARNING, not a hard block: the
    // client re-submits with acknowledged_over_limit:true to proceed.
    // The MARKED-UP total (markup now applies to every payment method) drives the warning, so it and the
    // earn-back tracker both reflect the real committed value.
    const _mk = await getNumber("STORE_MARKUP", 0.10);
    const orderTotalUsd = Math.round((Number(listing.price_usd) || 0) * (1 + _mk) * 100) / 100;
    const affordLimit = await getNumber("PHYSICAL_AFFORDABILITY_LIMIT_USD", 1460);
    if (affordLimit > 0 && orderTotalUsd > affordLimit && !acknowledged_over_limit) {
      return Response.json({
        affordability_warning: true,
        total_usd: orderTotalUsd,
        limit_usd: affordLimit,
        message: `This order is $${orderTotalUsd.toFixed(2)} — more than the ~$${affordLimit.toLocaleString()} a member can reasonably earn or pay back in a year. You can still proceed, or choose a lower-cost option, financing (Affirm), or layaway.`,
      });
    }

    // Teen/household gate: if the buyer is a teen whose order needs an adult's sign-off, log a
    // pending_approval order and STOP here — no claim, no charge (points or card). The adult approves in
    // Family & Teens, which then completes the purchase. Adults / non-members skip this entirely.
    const gate = purchaseGate(user, orderTotalUsd);
    if (gate.requiresApproval) {
      const pending = await base44.asServiceRole.entities.Order.create({
        user_id: user.id, seller_id: listing.seller_id, listing_id: listing.id, item_name: listing.title,
        amount: payment_method === "card" ? charged.usd || orderTotalUsd : null,
        points_spent: payment_method === "points" ? effectivePoints : null,
        payment_method, payment_captured: false, needs_approval: true, approver_id: gate.holder_id,
        household_id: gate.household_id || null, source, status: "pending_approval",
        created_at: new Date().toISOString(),
      }).catch(() => null);
      if (gate.holder_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: gate.holder_id, type: "household_approval_request",
          title: "👨‍👩‍👧 Approval needed",
          message: `${user.full_name || user.email || "A teen in your household"} wants to order "${listing.title}". Review it in Family & Teens.`,
          is_read: false,
        }).catch(() => null);
      }
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id, type: "marketplace_purchase",
        title: "⏳ Sent for approval",
        message: `Your order for "${listing.title}" was sent to your household adult to approve. Nothing is charged or reserved until they say yes.`, is_read: false,
      }).catch(() => null);
      return Response.json({ success: true, needs_approval: true, order_id: (pending as any)?.id || null,
        message: "Sent to your household adult for approval. You'll be notified when they respond." });
    }

    // Atomically CLAIM the listing (active → sold). If another buyer won the race, we bail before
    // charging — this closes the double-sell window.
    const claimed = await db.updateIf("MarketplaceListing", listing.id,
      { status: "sold", sold_to: user.id, sold_at: new Date().toISOString() },
      { field: "status", equals: "active" });
    if (!claimed) return Response.json({ error: "Sorry — this item was just sold.", status: 409 }, { status: 409 });

    // Now charge (we own the claim). On points: re-read the buyer for a fresh balance.
    if (payment_method === "points") {
      // ATOMIC debit (compare-and-set + retry) so two concurrent purchases can't both spend the same
      // points balance. Plain read-modify-write would let both read the same balance and lose one debit.
      let debited = false;
      for (let attempt = 0; attempt < 5 && !debited; attempt++) {
        const fresh = (await base44.asServiceRole.entities.User.filter({ id: user.id }))[0] || user;
        const bal = Number(fresh.points) || 0;
        if (bal < effectivePoints) {
          // Buyer spent their points elsewhere between pre-flight and claim → release the listing.
          await db.updateIf("MarketplaceListing", listing.id, { status: "active", sold_to: null }, { field: "status", equals: "sold" }).catch(() => null);
          return Response.json({ error: "Insufficient points", required: effectivePoints }, { status: 402 });
        }
        const ok = await db.updateIf("User", user.id, { points: bal - effectivePoints }, { field: "points", equals: String(bal) }).catch(() => false);
        if (ok) debited = true;
      }
      if (!debited) {
        await db.updateIf("MarketplaceListing", listing.id, { status: "active", sold_to: null }, { field: "status", equals: "sold" }).catch(() => null);
        return Response.json({ error: "Couldn't complete the purchase — please try again." }, { status: 409 });
      }
      // Credit the seller only when there's a real member seller. Platform-catalog points are platform
      // revenue (closed-loop), so there's no user to credit. Seller gets FULL list price; the welcome
      // discount is absorbed by the platform (and only applies to platform items anyway). Atomic credit.
      if (!isPlatform && seller) {
        for (let attempt = 0; attempt < 5; attempt++) {
          const s = (await base44.asServiceRole.entities.User.filter({ id: seller.id }))[0] || seller;
          const sb = Number(s.points) || 0;
          const ok = await db.updateIf("User", seller.id, { points: sb + pointsPrice }, { field: "points", equals: String(sb) }).catch(() => false);
          if (ok) break;
        }
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
    // Digital goods deliver online INSTANTLY (no shipping, no pickup) once paid; physical goods await
    // shipment/pickup. A card order still waits for capture before anything is delivered.
    const isDigital = listing.product_type === "digital" || listing.fulfillment_mode === "digital" || isDigitalCategory(listing.category);
    const orderStatus = !paidNow ? "awaiting_payment"
      : isDigital ? "delivered"
      : listing.fulfillment_mode === "pickup" ? "awaiting_pickup"
      : "awaiting_shipment";
    const fulfillment_type = isDigital ? "digital_delivery"
      : listing.fulfillment_mode === "pickup" ? "local_pickup"
      : (isPlatform ? "platform_ai" : "seller_ship");
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
      welcome_discount_usd: charged.welcome_discount_usd || 0,
      fulfillment_type,
      source,
      shipping_address: shipping_address || null,
      status: orderStatus,
      created_at: new Date().toISOString(),
    });

    // Make a captured purchase visible to the AI / self-learning layer (durable signal + funnel event).
    if (paidNow) {
      await recordPurchaseSignal({
        userId: user.id, valueUsd: Number(charged.usd) || Math.round((Number(charged.points) || 0)) / 100,
        points: Number(charged.points) || 0, listingId: listing.id, source,
        category: listing.category || null, paymentMethod: payment_method,
      }).catch(() => {});
      // Redeem the member discount from the POOL now that the sale is captured (points path). Funds only
      // what the pool holds (never store margin), advances the back-end cap, and writes the audit ledger.
      if (loyaltyDiscountUsd > 0 && loyaltyMemberId) {
        const funded = await fundDiscountFromPool(loyaltyMemberId, user.id, loyaltyDiscountUsd, String((order as any)?.id || listing.id)).catch(() => 0);
        charged.loyalty_discount_usd = funded;
      }
    }

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
