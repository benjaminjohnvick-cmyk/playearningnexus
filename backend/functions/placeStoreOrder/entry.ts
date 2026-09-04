import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isBusinessAccount, applyMarkup, STORE_MARKUP } from "../../sdk/payout-policy.ts";
import { getNumber } from "../../sdk/settings.ts";
import { blockedOrderReason } from "../../sdk/catalog-policy.ts";
import { db } from "../../sdk/db.ts";
import { recordPurchaseSignal } from "../../sdk/purchase-signal.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { recordMoneyFlow } from "../../sdk/paypal.ts";
import { isPremiumUser } from "../../sdk/survey-reward.ts";
import { siteCashApplyPlan, resolveSiteCashAutoApply } from "../../sdk/site-cash-apply.ts";
import { paypalConfigured, captureOrder, getOrder } from "../../sdk/paypal-api.ts";

// Server-authoritative store order (product OR online service → pay → AI fulfillment).
//
// Payment methods:
//   • survey_balance  — spends the user's in-store credit (current_balance). Regular users pay the
//                       10% markup; business accounts are exempt.
//   • refund_credit   — spends REFUND store credit (refund_credit_balance). NO markup for ANYONE
//                       (businesses or customers) — refunded credits are always markup-free.
//   • credit_card     — the card charge is VERIFIED server-side against PayPal (getOrder/capture) before the
//                       order is created; a client-supplied paypal_order_id is never trusted on its own.
//
// Order kinds: physical_product (ships to an address) or online_service (digital — no shipping).
// AI fulfillment is fired for both; services are delivered digitally.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { product = {}, shipping_address, payment_method = "survey_balance", paypal_order_id } = body;

    const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
    const orderKind = product.product_type === "online_service" || body.order_type === "online_service"
      ? "online_service" : "physical_product";
    // Physical products must ship somewhere; online services don't.
    if (orderKind === "physical_product" && !shipping_address) {
      return Response.json({ error: "Missing shipping_address" }, { status: 400 });
    }

    // Compliance (Wave 2): block regulated / age-restricted categories from AI fulfillment.
    const __blocked = blockedOrderReason({
      name: product.product_name || product.name,
      category: product.category || product.product_category,
    });
    if (__blocked) {
      return Response.json({ error: `This item can't be fulfilled: ${__blocked}. Regulated and age-restricted products are not available.` }, { status: 400 });
    }

    const business = isBusinessAccount(user.role);
    const rawPrice = Number(product.price ?? (product.price_with_markup ? product.price_with_markup / (1 + STORE_MARKUP) : 0)) || 0;
    if (rawPrice <= 0) return Response.json({ error: "Invalid product price" }, { status: 400 });

    // Markup rule: NONE on refund-credit payments (anyone), NONE for business accounts; otherwise 10%.
    const markupFree = payment_method === "refund_credit" || business;
    // Store markup is admin-adjustable live (STORE_MARKUP). applyMarkup() stays as the env-default fallback.
    const markupRate = markupFree ? 0 : await getNumber("STORE_MARKUP", STORE_MARKUP);
    const charge = round2(rawPrice * (1 + markupRate));
    const markupApplied = round2(charge - rawPrice);

    // Deduct the right balance on the server (authoritative), ATOMICALLY (compare-and-set with retry) so
    // two concurrent orders can't both pass the same balance check and double-spend.
    let newBalance: number | undefined;
    let newRefundBalance: number | undefined;
    async function atomicDebit(field: string, needed: number): Promise<{ ok: boolean; next?: number; cur?: number; contended?: boolean }> {
      for (let i = 0; i < 6; i++) {
        const fresh = (await base44.asServiceRole.entities.User.filter({ id: user.id }))[0] || {};
        const cur = Number((fresh as Record<string, unknown>)[field] ?? 0);
        if (cur < needed) return { ok: false, cur };
        const next = round2(cur - needed);
        const done = await db.updateIf("User", user.id, { [field]: next }, { field, equals: String(cur) }).catch(() => null);
        if (done) return { ok: true, next };
      }
      return { ok: false, contended: true };
    }
    if (payment_method === "survey_balance") {
      const r = await atomicDebit("current_balance", charge);
      if (!r.ok) return Response.json({ error: r.contended ? "Please retry — balance is being updated." : "Insufficient store credit", required: charge, balance: r.cur }, { status: r.contended ? 409 : 402 });
      newBalance = r.next;
    } else if (payment_method === "refund_credit") {
      const r = await atomicDebit("refund_credit_balance", charge);
      if (!r.ok) return Response.json({ error: r.contended ? "Please retry — balance is being updated." : "Insufficient refund credit", required: charge, refund_balance: r.cur }, { status: r.contended ? 409 : 402 });
      newRefundBalance = r.next;
    }
    // credit_card path: captured client-side (paypal_order_id). AUTO-APPLY SITE CASH here (server-authoritative):
    // deduct the buyer's non-cashable points, record the money flow, and the card charge is the reduced
    // remainder. The client fetched the same figure from checkoutSiteCashQuote and captured card_charge_usd, so
    // the two match. Honors the buyer's own auto-apply preference. Site Cash only lowers the REAL-money (card)
    // charge — balance-funded methods (survey_balance / refund_credit) are already site credit and unchanged.
    // First COMPUTE the Site-Cash auto-apply plan (do NOT deduct yet) so we know the real card charge to verify.
    let siteCashUsd = 0, pointsApplied = 0;
    let cardCharge = charge;
    let pendingPlan: { points_applied: number; points_usd: number; card_after_usd: number } | null = null;
    if (payment_method === "credit_card" && resolveSiteCashAutoApply(user as Record<string, unknown>) && (Number(user.points) || 0) > 0) {
      const premium = await isPremiumUser(String(user.id));
      const plan = siteCashApplyPlan({ faceUsd: charge, userPoints: Number(user.points) || 0, isPremium: premium });
      if (plan.points_applied > 0) { pendingPlan = plan; cardCharge = plan.card_after_usd; }
    }

    // ── SERVER-SIDE PAYMENT VERIFICATION (credit_card) ──────────────────────────────────────────────────
    // Do not trust a client-supplied paypal_order_id. Before creating/fulfilling the order we verify the
    // payment with PayPal server-side: the order must be COMPLETED (capturing it here if the client only
    // approved it) AND the captured amount must match the real card charge. On any failure we reject and
    // fulfill nothing. (If the card charge is $0 — fully covered by Site Cash — there is nothing to verify.)
    if (payment_method === "credit_card" && cardCharge > 0.009) {
      if (!paypal_order_id) {
        return Response.json({ error: "Missing payment reference (paypal_order_id) for a card charge." }, { status: 402 });
      }
      if (!paypalConfigured()) {
        return Response.json({ error: "Card payments are unavailable right now (payment processor not configured)." }, { status: 402 });
      }
      let paid = false, paidAmt = 0, payStatus = "";
      try {
        const got = await getOrder(String(paypal_order_id));
        payStatus = got.status;
        if (got.status === "COMPLETED" && got.captured) {
          paid = true; paidAmt = got.amount_usd;
        } else if (got.status === "APPROVED") {
          // Client approved but didn't capture — capture it now, server-side.
          const cap = await captureOrder(String(paypal_order_id));
          payStatus = cap.status;
          if (cap.captured) { paid = true; paidAmt = cap.amount_usd; }
        }
      } catch (e) {
        return Response.json({ error: `Could not verify payment: ${(e as Error).message}` }, { status: 402 });
      }
      if (!paid) {
        return Response.json({ error: `Payment not completed (status: ${payStatus || "unknown"}). Your order was not placed and you were not charged.` }, { status: 402 });
      }
      // Amount must match the server-computed card charge (1-cent tolerance for rounding).
      if (Math.abs(paidAmt - cardCharge) > 0.02) {
        return Response.json({ error: "Payment amount doesn't match the order total. Your order was not placed.", expected_usd: cardCharge, paid_usd: paidAmt }, { status: 402 });
      }
    }

    // Payment is verified (or not a card charge) — NOW deduct the Site Cash points and record the money flow.
    if (pendingPlan) {
      const ok = await adjustUserBalance(String(user.id), -pendingPlan.points_applied, { field: "points" });
      if (ok !== null) {
        await recordMoneyFlow({ direction: "out", amount_usd: pendingPlan.points_usd, kind: "points_redemption_fulfillment", ref: String(product.product_name || product.name || "store_order"), meta: { user_id: user.id, points_applied: pendingPlan.points_applied, funded_by: "paypal_business_account", auto_applied: true } }).catch(() => null);
        siteCashUsd = pendingPlan.points_usd;
        pointsApplied = pendingPlan.points_applied;
      }
    }

    const order = await base44.asServiceRole.entities.Order.create({
      user_id: user.id,
      product_name: product.product_name || product.name,
      product_image_url: product.product_image_url || product.image_url,
      product_type: orderKind,
      service_delivery: orderKind === "online_service" ? (product.service_delivery || "digital") : null,
      source: product.source || "product_search",
      raw_price: rawPrice,
      markup_applied: markupApplied,
      amount: charge,
      site_cash_applied_usd: siteCashUsd,
      points_spent: pointsApplied || null,
      card_charge_usd: payment_method === "credit_card" ? cardCharge : null,
      payment_method,
      paypal_order_id: paypal_order_id ?? null,
      vendor_name: product.vendor_name || product.vendor,
      vendor_url: product.vendor_url || product.url,
      advertiser_user_id: product.advertiser_user_id || product.owner_user_id || null,
      shipping_address: orderKind === "online_service" ? null : shipping_address,
      shipping_status: "pending_ai_fulfillment",
      ai_vetting_status: "not_started",
      funds_released: false,
      account_type: business ? "business" : "regular",
      notes: markupFree
        ? (payment_method === "refund_credit" ? "Paid with refund credit — no markup." : "Business account — no markup.")
        : "Regular user — 10% platform markup applied.",
    });

    // NOTE: advertiser "doubling" attribution is intentionally NOT done here. It is credited once, at
    // fund-release, in autoOrderFulfillmentAndFundsRelease (creditAdvertiserOrder) — pay-for-performance
    // on delivered value. Crediting here too would DOUBLE-count every order toward the doubling target.

    // Make this purchase visible to the AI / self-learning layer (durable OptimizationSignal +
    // InteractionEvent) so the platform has data on what members buy. Best-effort.
    await recordPurchaseSignal({
      userId: user.id, valueUsd: charge, source: product.source || "store",
      category: product.category || product.product_category || null, paymentMethod: payment_method,
    }).catch(() => {});

    // Fire the autonomous AI fulfillment pipeline (ships physical; delivers services digitally).
    base44.asServiceRole.functions.invoke("aiOrderFulfillment", { order_id: order.id }).catch(() => {});

    return Response.json({
      ok: true,
      order_id: order.id,
      order_kind: orderKind,
      charged: charge,
      card_charge_usd: payment_method === "credit_card" ? cardCharge : undefined,
      site_cash_applied_usd: siteCashUsd,
      points_spent: pointsApplied || 0,
      markup_applied: markupApplied,
      markup_free: markupFree,
      account_type: business ? "business" : "regular",
      new_balance: newBalance,
      new_refund_balance: newRefundBalance,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
