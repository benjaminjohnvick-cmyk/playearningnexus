import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getNumber, getBool } from "../../sdk/settings.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { db } from "../../sdk/db.ts";
import { PLATFORM_SELLER_ID, isDigitalCategory } from "../../sdk/catalog.ts";
import { welcomeDiscountFor } from "../../sdk/welcome-credit.ts";
import { purchaseGate } from "../../sdk/household.ts";

// oneClickPurchase (authenticated) — Amazon-style "Buy now". It LOGS the order immediately in an
// awaiting_payment state, so the user's intent is captured in one click, and:
//   • if a card is on file AND card charging is enabled, the order is flagged ready for the processor to
//     charge the saved card (capture happens in the external processor path — we never touch raw card
//     numbers);
//   • if no card is on file, we still log the order and tell them to add a card to complete it.
// Nothing is fulfilled until payment is actually captured, and — unlike a normal buy — we DON'T claim
// the listing, so an unpaid one-click order never locks a member's one-of-a-kind item.
// Body: { listing_id, acknowledged_over_limit? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { listing_id, acknowledged_over_limit } = await req.json().catch(() => ({}));
    if (!listing_id) return Response.json({ error: "listing_id required" }, { status: 400 });

    const listing = await db.get("MarketplaceListing", listing_id).catch(() => null) as any;
    if (!listing) return Response.json({ error: "Listing not found" }, { status: 404 });
    if (listing.status !== "active") return Response.json({ error: `This item is ${listing.status}.` }, { status: 409 });
    if (listing.source === "affiliate") return Response.json({ error: "Affiliate items are bought at the retailer, not one-click." }, { status: 400 });
    if (listing.seller_id === user.id) return Response.json({ error: "You can't buy your own listing." }, { status: 400 });

    const base = Number(listing.price_usd) || 0;
    if (base <= 0) return Response.json({ error: "This item isn't available for card purchase." }, { status: 400 });
    const isPlatform = listing.source === "platform_catalog" || listing.seller_id === PLATFORM_SELLER_ID;

    const markup = await getNumber("STORE_MARKUP", 0.10);
    const gross = base * (1 + markup);
    // Welcome credit (platform items), funded by the markup, capped so the charge never drops below base.
    let wd = 0;
    if (isPlatform) {
      wd = await welcomeDiscountFor(user.id, base).catch(() => 0);
      if (await getBool("PROMO_FUNDED_BY_MARKUP", true)) wd = Math.min(wd, base * markup);
    }
    const total = Math.round(Math.max(base, gross - wd) * 100) / 100;

    // Affordability warning (same threshold as the rest of the store).
    const affordLimit = await getNumber("PHYSICAL_AFFORDABILITY_LIMIT_USD", 1460);
    if (affordLimit > 0 && gross > affordLimit && !acknowledged_over_limit) {
      return Response.json({
        affordability_warning: true, total_usd: Math.round(gross * 100) / 100, limit_usd: affordLimit,
        message: `This order is $${gross.toFixed(2)} — more than the ~$${affordLimit.toLocaleString()} a member can reasonably earn or pay back in a year. Proceed, or choose points, financing, or layaway.`,
      });
    }

    const hasCard = !!user.card_on_file;
    const charging = await isEnabled("card_charging").catch(() => false);
    const isDigital = listing.product_type === "digital" || listing.fulfillment_mode === "digital" || isDigitalCategory(listing.category);
    const fulfillment_type = isDigital ? "digital_delivery" : listing.fulfillment_mode === "pickup" ? "local_pickup" : (isPlatform ? "platform_ai" : "seller_ship");

    // Teen/household gate: a teen member's order routes to the adult holder for approval (unless it's
    // at/under the teen's per-order auto-approve limit). Adults/non-members are never gated.
    const gate = purchaseGate(user, gross);

    // Log the order immediately — NOT captured, NOT claiming the listing. Teen orders that need sign-off
    // open as pending_approval; everyone else opens as awaiting_payment.
    const order = await base44.asServiceRole.entities.Order.create({
      user_id: user.id, seller_id: listing.seller_id, listing_id: listing.id, item_name: listing.title,
      amount: total, payment_method: "card", payment_captured: false, one_click: true,
      needs_card: !hasCard, ready_to_charge: hasCard && charging && !gate.requiresApproval,
      needs_approval: gate.requiresApproval, approver_id: gate.requiresApproval ? gate.holder_id : null,
      household_id: gate.household_id || null,
      markup_applied: Math.round(base * markup * 100) / 100, welcome_discount_usd: Math.round(wd * 100) / 100,
      fulfillment_type, source: listing.source || "user",
      status: gate.requiresApproval ? "pending_approval" : "awaiting_payment",
      created_at: new Date().toISOString(),
    }).catch(() => null);

    if (gate.requiresApproval && gate.holder_id) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: gate.holder_id, type: "household_approval_request",
        title: "👨‍👩‍👧 Approval needed",
        message: `${user.full_name || user.email || "A teen in your household"} wants to order "${listing.title}" ($${total.toFixed(2)}). Review it in Family & Teens.`,
        is_read: false,
      }).catch(() => null);
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id, type: "one_click_order",
        title: "⏳ Sent for approval",
        message: `Your order for "${listing.title}" ($${total.toFixed(2)}) was sent to your household adult to approve. Nothing is charged until they say yes.`,
        is_read: false,
      }).catch(() => null);
      return Response.json({
        ok: true, order_id: (order as any)?.id || null, total_usd: total,
        needs_approval: true,
        message: `Sent to your household adult for approval ($${total.toFixed(2)}). You'll be notified when they respond.`,
      });
    }

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id, type: "one_click_order",
      title: "🛒 Order placed",
      message: (hasCard && charging)
        ? `Your card on file will be charged $${total.toFixed(2)} for "${listing.title}". You'll get it once payment clears.`
        : `Your order for "${listing.title}" ($${total.toFixed(2)}) is saved. Add a card to complete it — nothing is charged or shipped until then.`,
      is_read: false,
    }).catch(() => null);

    return Response.json({
      ok: true, order_id: (order as any)?.id || null, total_usd: total,
      needs_card: !hasCard, card_charging: charging,
      message: (hasCard && charging)
        ? `Order placed — charging your card on file ($${total.toFixed(2)}).`
        : `Order saved ($${total.toFixed(2)}). Add a card to complete it — it won't be charged or fulfilled until then.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
