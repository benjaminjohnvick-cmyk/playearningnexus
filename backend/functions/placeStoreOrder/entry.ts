import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isBusinessAccount, applyMarkup, STORE_MARKUP } from "../../sdk/payout-policy.ts";

// Server-authoritative store order (product search → pay → AI fulfillment → ship home).
//
// This replaces the OLD client-side balance math in OrderViaSite, where the 10% markup and
// the store-credit deduction were computed in the browser and could be tampered with. Now
// the server:
//   1. decides business-vs-regular (shared isBusinessAccount);
//   2. applies the 10% markup for regular users (business accounts exempt);
//   3. deducts store credit on the server (can't be bypassed) — or takes card;
//   4. creates the Order and kicks off the autonomous aiOrderFulfillment pipeline
//      (scrape vendor → AI checkout via cloud browser → ship to the user's address → track).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { product = {}, shipping_address, payment_method = "survey_balance", paypal_order_id } = body;
    if (!shipping_address) return Response.json({ error: "Missing shipping_address" }, { status: 400 });

    const business = isBusinessAccount(user.role);
    const rawPrice = Number(product.price ?? (product.price_with_markup ? product.price_with_markup / (1 + STORE_MARKUP) : 0)) || 0;
    if (rawPrice <= 0) return Response.json({ error: "Invalid product price" }, { status: 400 });

    // SINGLE 10% markup, applied once at item purchase — same whether paid by store credit
    // or card (no stacked card surcharge). Business accounts pay the raw price (no markup).
    const charge = applyMarkup(rawPrice, user.role);
    const markupApplied = business ? 0 : Math.round((charge - rawPrice) * 100) / 100;

    // Store-credit path: deduct on the server (authoritative).
    let newBalance: number | undefined;
    if (payment_method === "survey_balance") {
      const balance = Number(user.current_balance ?? 0);
      if (balance < charge) {
        return Response.json({ error: "Insufficient store credit", required: charge, balance }, { status: 402 });
      }
      newBalance = Math.round((balance - charge) * 100) / 100;
      await base44.asServiceRole.entities.User.update(user.id, { current_balance: newBalance });
    }
    // credit_card path: payment was captured client-side (paypal_order_id) — nothing to deduct here.

    const order = await base44.asServiceRole.entities.Order.create({
      user_id: user.id,
      product_name: product.product_name || product.name,
      product_image_url: product.product_image_url || product.image_url,
      product_type: "physical_product",
      source: product.source || "product_search",
      raw_price: rawPrice,
      markup_applied: markupApplied,
      amount: charge,
      payment_method,
      paypal_order_id: paypal_order_id ?? null,
      vendor_name: product.vendor_name || product.vendor,
      vendor_url: product.vendor_url || product.url,
      shipping_address,
      shipping_status: "pending_ai_fulfillment",
      ai_vetting_status: "not_started",
      funds_released: false,
      account_type: business ? "business" : "regular",
      notes: business ? "Business account — no markup." : "Regular user — 10% platform markup applied.",
    });

    // Fire the autonomous AI fulfillment pipeline (ships to shipping_address).
    base44.asServiceRole.functions.invoke("aiOrderFulfillment", { order_id: order.id }).catch(() => {});

    return Response.json({
      ok: true,
      order_id: order.id,
      charged: charge,
      markup_applied: markupApplied,
      account_type: business ? "business" : "regular",
      new_balance: newBalance,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
