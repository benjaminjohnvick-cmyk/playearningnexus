import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, getNumber } from "../../sdk/settings.ts";
import { pointValueUsd, recordRevenue } from "../../sdk/revenue.ts";
import { revenueSplit, payoutCurrency } from "../../sdk/hosting-monetization.ts";

// liveShoppingOrder — places an order from a live-shopping / QVC-style hosted session and feeds it into the
// EXISTING order → fulfillment → funds-release pipeline (nothing new for moving money). The buyer pays in SITE
// CASH (points); the platform's 50% is recorded to the revenue ledger; the order is created with
// shipping_status "pending_ai_fulfillment" so autoOrderFulfillmentAndFundsRelease releases the seller's proceeds
// on delivery. INVARIANT: a BUSINESS seller is paid REAL money (through that pipeline); a user seller is credited
// SITE CASH; the buyer (a user) only ever spends/earns Site Cash. Gated behind SESSION_HOSTING_ENABLED +
// HOSTING_LIVE_SHOPPING_ENABLED.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("SESSION_HOSTING_ENABLED", false) || !snapBool("HOSTING_LIVE_SHOPPING_ENABLED", false)) {
      return Response.json({ error: "Live shopping is disabled (SESSION_HOSTING_ENABLED / HOSTING_LIVE_SHOPPING_ENABLED)." }, { status: 409 });
    }

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body?.session_id || "");
    const itemName = String(body?.item?.name || body?.item_name || "").slice(0, 200);
    const unitPrice = Math.max(0, Number(body?.item?.price_usd ?? body?.price_usd) || 0);
    const qty = Math.max(1, Math.floor(Number(body?.quantity) || 1));
    if (!sessionId || !itemName || unitPrice <= 0) {
      return Response.json({ error: "session_id, item name, and a positive price_usd are required." }, { status: 400 });
    }

    // Load the hosted session; it must be a live-shopping/retail session.
    const sess = (await db.filter("GameSession", { session_id: sessionId }, undefined, 1).catch(() => []))[0] as Record<string, unknown> | undefined;
    if (!sess) return Response.json({ error: "unknown session" }, { status: 404 });
    if (!["live_shopping_5050", "retail_5050"].includes(String(sess.monetization || ""))) {
      return Response.json({ error: "this session is not a retail / live-shopping session" }, { status: 409 });
    }
    const sellerId = String(body?.seller_id || sess.host_player_id || sess.started_by || "");
    const sellerIsBusiness = body?.seller_is_business !== false; // live-shopping sellers are businesses by default

    const priceUsd = Math.round(unitPrice * qty * 100) / 100;
    const ppv = pointValueUsd();                       // USD per point (default $0.01)
    const pointsNeeded = Math.ceil(priceUsd / ppv);

    // Buyer pays in Site Cash — never a debt. Check balance, then debit atomically; refund on a race.
    const available = Math.max(0, Number(user.points) || 0);
    if (available < pointsNeeded) {
      return Response.json({ ok: false, error: "insufficient Site Cash", needed_points: pointsNeeded, available_points: available }, { status: 402 });
    }
    const newBal = await db.incrementField("User", String(user.id), "points", -pointsNeeded).catch(() => null);
    if (newBal == null) return Response.json({ error: "could not debit Site Cash" }, { status: 500 });
    if (Number(newBal) < 0) {
      await db.incrementField("User", String(user.id), "points", pointsNeeded).catch(() => null); // refund the race loser
      return Response.json({ ok: false, error: "insufficient Site Cash (concurrent spend)", }, { status: 402 });
    }

    // 50/50 split (or the configured platform %).
    const split = revenueSplit(priceUsd, await getNumber("HOSTING_REVENUE_PLATFORM_PCT", 50));
    const sellerCurrency = payoutCurrency(sellerIsBusiness);   // business → real_money, user → site_cash

    // Create the order in the EXISTING pipeline. shipping_status drives autoOrderFulfillmentAndFundsRelease.
    const order = await base44.asServiceRole.entities.Order.create({
      user_id: user.id, seller_id: sellerId, item_name: itemName, quantity: qty,
      amount: priceUsd, total_usd: priceUsd,
      payment_method: "site_cash", points_spent: pointsNeeded, payment_captured: true,
      source: "live_shopping", session_id: sessionId,
      platform_usd: split.platform_usd, seller_net_usd: split.seller_usd, seller_payout_currency: sellerCurrency,
      revenue_split_pct: split.platform_pct,
      shipping_status: "pending_ai_fulfillment", funds_released: false,
      created_at: new Date().toISOString(),
    }).catch(() => null);
    if (!order) {
      await db.incrementField("User", String(user.id), "points", pointsNeeded).catch(() => null); // refund
      return Response.json({ error: "could not create order (Site Cash refunded)" }, { status: 500 });
    }
    const orderId = String((order as Record<string, unknown>).id ?? "");

    // Record the platform's share to the revenue ledger (existing system). Never a customer markup.
    await recordRevenue({ type: "seller_commission", amount_usd: split.platform_usd, business_id: sellerIsBusiness ? sellerId : null, user_id: user.id, ref: orderId, meta: { source: "live_shopping", session_id: sessionId, seller_net_usd: split.seller_usd, seller_payout_currency: sellerCurrency } }).catch(() => null);

    // If the seller is a USER (not a business), credit their share as Site Cash pending (closed loop) rather than
    // a real-money payout. Business sellers are paid real money by the existing funds-release pipeline on delivery.
    if (!sellerIsBusiness && sellerId) {
      const sellerPoints = Math.round(split.seller_usd / ppv);
      await db.incrementField("User", sellerId, "pending_points", sellerPoints).catch(() => null);
    }

    return Response.json({
      ok: true, order_id: orderId, session_id: sessionId,
      charged_points: pointsNeeded, price_usd: priceUsd,
      split: { platform_usd: split.platform_usd, seller_usd: split.seller_usd, platform_pct: split.platform_pct },
      seller_payout_currency: sellerCurrency,
      note: `Order placed. You paid ${pointsNeeded} Site Cash. Split ${split.platform_pct}/${split.seller_pct}. ` +
        (sellerIsBusiness
          ? "The business seller is paid REAL money by the existing fulfillment/funds-release pipeline on delivery."
          : "The seller is a user, so their share is credited as Site Cash.") +
        " Users only ever get Site Cash.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
