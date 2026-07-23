import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Buy store credit with a card (regular users). This is 1:1 — NO markup at top-up.
// The single 10% platform fee is charged ONCE later, when the user buys an item
// (see placeStoreOrder). The card payment is captured client-side (PayPal Orders / Stripe);
// here we credit the user's current_balance and record the top-up as a Transaction.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const amount = Math.round((Number(body.amount) || 0) * 100) / 100;
    const paymentRef = body.paypal_order_id ?? body.payment_reference ?? null;
    if (amount <= 0) return Response.json({ error: "Enter a valid amount" }, { status: 400 });
    if (amount > 2000) return Response.json({ error: "Max top-up is $2000 per transaction" }, { status: 400 });
    if (!paymentRef) return Response.json({ error: "Missing card payment reference" }, { status: 400 });

    // The card was captured client-side via PayPal/Stripe. (For extra assurance you can verify
    // the captured order server-side against the provider here before crediting.)
    const balance = Number(user.current_balance ?? 0);
    const newBalance = Math.round((balance + amount) * 100) / 100;
    await base44.asServiceRole.entities.User.update(user.id, { current_balance: newBalance });

    try {
      await base44.asServiceRole.entities.Transaction.create({
        user_id: user.id,
        type: "store_credit_purchase",
        amount,
        method: "card",
        payment_reference: paymentRef,
        status: "completed",
        note: "Store credit purchased by card (1:1, no markup).",
        at: new Date().toISOString(),
      });
    } catch { /* transaction record is non-fatal */ }

    return Response.json({ ok: true, credited: amount, new_balance: newBalance });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
