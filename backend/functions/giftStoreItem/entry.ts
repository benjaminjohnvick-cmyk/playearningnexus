import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isBusinessAccount, applyMarkup, STORE_MARKUP } from "../../sdk/payout-policy.ts";
import { getNumber } from "../../sdk/settings.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { blockedOrderReason } from "../../sdk/catalog-policy.ts";

// giftStoreItem — buy a catalog product/service and have it delivered to ANOTHER user.
//
// This preserves the social "send something to a friend" feature WITHOUT transferring spendable value
// between users (the money-transmission trigger that p2p_transfers guards). The GIVER pays from their
// own balance; the RECIPIENT receives the fulfilled ITEM, never credit. So it's a purchase with a
// delivery redirect, not a peer-to-peer money movement.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const giver = await base44.auth.me();
    if (!giver) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { recipient_user_id, product = {}, shipping_address, gift_message, payment_method = "survey_balance" } = body;
    if (!recipient_user_id || recipient_user_id === giver.id) {
      return Response.json({ error: "A valid recipient_user_id (not yourself) is required." }, { status: 400 });
    }
    const recipient = await base44.asServiceRole.entities.User.get(recipient_user_id);
    if (!recipient) return Response.json({ error: "Recipient not found." }, { status: 404 });

    // Same catalog guardrail as a normal order — no regulated/age-restricted gifts.
    const __blocked = blockedOrderReason({ name: product.product_name || product.name, category: product.category || product.product_category });
    if (__blocked) return Response.json({ error: `This item can't be gifted: ${__blocked}.` }, { status: 400 });

    const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
    const orderKind = product.product_type === "online_service" || body.order_type === "online_service" ? "online_service" : "physical_product";
    if (orderKind === "physical_product" && !shipping_address) {
      return Response.json({ error: "A shipping_address for the recipient is required for physical gifts." }, { status: 400 });
    }

    const business = isBusinessAccount(giver.role);
    const rawPrice = Number(product.price ?? (product.price_with_markup ? product.price_with_markup / (1 + STORE_MARKUP) : 0)) || 0;
    if (rawPrice <= 0) return Response.json({ error: "Invalid product price" }, { status: 400 });

    // Markup rule matches placeStoreOrder: none on refund credit / business; otherwise 10%.
    const markupFree = payment_method === "refund_credit" || business;
    const markupRate = markupFree ? 0 : await getNumber("STORE_MARKUP", STORE_MARKUP);
    const charge = round2(rawPrice * (1 + markupRate));

    // Deduct from the GIVER only (their own funds; no value moves to the recipient's balance).
    // Atomic compare-and-set debit — a null result means insufficient funds or contention, and we
    // must NOT create the gift order if the giver was never charged.
    if (payment_method === "survey_balance") {
      const bal = Number(giver.current_balance ?? 0);
      if (bal < charge) return Response.json({ error: "Insufficient store credit", required: charge, balance: bal }, { status: 402 });
      const ok = await adjustUserBalance(giver.id, -charge, { field: "current_balance" });
      if (ok == null) return Response.json({ error: "Insufficient store credit or balance is being updated — please retry.", required: charge }, { status: 402 });
    } else if (payment_method === "refund_credit") {
      const rb = Number(giver.refund_credit_balance ?? 0);
      if (rb < charge) return Response.json({ error: "Insufficient refund credit", required: charge, refund_balance: rb }, { status: 402 });
      const ok = await adjustUserBalance(giver.id, -charge, { field: "refund_credit_balance" });
      if (ok == null) return Response.json({ error: "Insufficient refund credit or balance is being updated — please retry.", required: charge }, { status: 402 });
    }

    // The order is fulfilled to the RECIPIENT — they get the item, not credit.
    const order = await base44.asServiceRole.entities.Order.create({
      user_id: recipient_user_id, gifted_by_user_id: giver.id, is_gift: true, gift_message: gift_message ?? null,
      product_name: product.product_name || product.name, product_type: orderKind,
      service_delivery: orderKind === "online_service" ? (product.service_delivery || "digital") : null,
      raw_price: rawPrice, amount: charge, payment_method,
      shipping_address: orderKind === "online_service" ? null : shipping_address,
      shipping_status: "pending_ai_fulfillment", ai_vetting_status: "not_started", funds_released: false,
      account_type: business ? "business" : "regular",
      notes: `Gift from ${giver.full_name || giver.email} to ${recipient.full_name || recipient.email}.`,
    });

    base44.asServiceRole.functions.invoke("aiOrderFulfillment", { order_id: order.id }).catch(() => {});

    await base44.asServiceRole.entities.Notification.create({
      user_id: recipient_user_id, type: "gift_received",
      title: `🎁 You received a gift!`,
      message: `${giver.full_name || "Someone"} sent you ${product.product_name || product.name}${gift_message ? `: "${gift_message}"` : "."} It's being fulfilled now.`,
      is_read: false,
    }).catch(() => null);

    return Response.json({ ok: true, order_id: order.id, gifted_to: recipient_user_id, charged: charge });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
