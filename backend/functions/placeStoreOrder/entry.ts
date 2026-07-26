import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isBusinessAccount, applyMarkup, STORE_MARKUP } from "../../sdk/payout-policy.ts";

// Server-authoritative store order (product OR online service → pay → AI fulfillment).
//
// Payment methods:
//   • survey_balance  — spends the user's in-store credit (current_balance). Regular users pay the
//                       10% markup; business accounts are exempt.
//   • refund_credit   — spends REFUND store credit (refund_credit_balance). NO markup for ANYONE
//                       (businesses or customers) — refunded credits are always markup-free.
//   • credit_card     — captured client-side (paypal_order_id); nothing to deduct here.
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

    const business = isBusinessAccount(user.role);
    const rawPrice = Number(product.price ?? (product.price_with_markup ? product.price_with_markup / (1 + STORE_MARKUP) : 0)) || 0;
    if (rawPrice <= 0) return Response.json({ error: "Invalid product price" }, { status: 400 });

    // Markup rule: NONE on refund-credit payments (anyone), NONE for business accounts; otherwise 10%.
    const markupFree = payment_method === "refund_credit" || business;
    const charge = markupFree ? round2(rawPrice) : applyMarkup(rawPrice, user.role);
    const markupApplied = round2(charge - rawPrice);

    // Deduct the right balance on the server (authoritative).
    let newBalance: number | undefined;
    let newRefundBalance: number | undefined;
    if (payment_method === "survey_balance") {
      const balance = Number(user.current_balance ?? 0);
      if (balance < charge) return Response.json({ error: "Insufficient store credit", required: charge, balance }, { status: 402 });
      newBalance = round2(balance - charge);
      await base44.asServiceRole.entities.User.update(user.id, { current_balance: newBalance });
    } else if (payment_method === "refund_credit") {
      const rb = Number(user.refund_credit_balance ?? 0);
      if (rb < charge) return Response.json({ error: "Insufficient refund credit", required: charge, refund_balance: rb }, { status: 402 });
      newRefundBalance = round2(rb - charge);
      await base44.asServiceRole.entities.User.update(user.id, { refund_credit_balance: newRefundBalance });
    }
    // credit_card path: captured client-side (paypal_order_id) — nothing to deduct here.

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

    // Doubling tracker: if this order is for a specific advertiser's product/service, count it toward
    // that advertiser's "$10,000 in orders" doubling target (which gates their free social credits).
    const advId = product.advertiser_user_id || product.owner_user_id;
    if (advId) {
      const rows = await base44.asServiceRole.entities.User.filter({ id: advId });
      const advUser = (rows || [])[0];
      if (advUser) {
        await base44.asServiceRole.entities.User.update(advId, {
          ppc_orders_value_delivered: round2(Number(advUser.ppc_orders_value_delivered ?? 0) + rawPrice),
        }).catch(() => null);
      }
    }

    // Fire the autonomous AI fulfillment pipeline (ships physical; delivers services digitally).
    base44.asServiceRole.functions.invoke("aiOrderFulfillment", { order_id: order.id }).catch(() => {});

    return Response.json({
      ok: true,
      order_id: order.id,
      order_kind: orderKind,
      charged: charge,
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
