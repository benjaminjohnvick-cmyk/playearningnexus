import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";

const MAX_IAP_PRICE = 10000;            // sanity ceiling on a single purchase ($)
const MAX_CURRENCY_GRANT = 10_000_000;  // sanity ceiling on granted virtual currency

export default __handler(async (req) => {
  // Grants inventory/currency — must not be callable by arbitrary public clients. Accept an internal
  // invoke, an admin, or a request bearing the configured IAP webhook secret (set IAP_WEBHOOK_SECRET
  // and have the store/proxy send it as x-iap-webhook-secret when wiring a real app-store webhook).
  const webhookSecret = Deno.env.get("IAP_WEBHOOK_SECRET");
  const secretOk = !!webhookSecret && req.headers.get("x-iap-webhook-secret") === webhookSecret;
  if (!secretOk) {
    const denied = await requireInternalOrAdmin(req);
    if (denied) return denied;
  }

  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (event?.type !== 'create') return Response.json({ ok: true });
    const iap = data;
    if (!iap?.user_id || !iap?.product_id) return Response.json({ ok: true });

    // Bound the client-supplied amounts so a caller can't mint unlimited value.
    const iapPrice = Number(iap.price) || 0;
    const currencyAmount = Number(iap.currency_amount) || 0;
    if (iapPrice < 0 || iapPrice > MAX_IAP_PRICE || currencyAmount < 0 || currencyAmount > MAX_CURRENCY_GRANT) {
      return Response.json({ error: "Invalid IAP amount" }, { status: 400 });
    }

    // Idempotency: never process the same purchase twice (replay protection).
    const iapRef = iap.id || iap.transaction_id || iap.receipt_id || null;
    if (iapRef) {
      const dupes = await base44.asServiceRole.entities.Transaction.filter({ iap_ref: iapRef });
      if ((dupes || []).length) return Response.json({ ok: true, deduped: true });
    }

    // Create Transaction record
    await base44.asServiceRole.entities.Transaction.create({
      user_id: iap.user_id,
      game_id: iap.game_id,
      product_id: iap.product_id,
      amount: iapPrice,
      currency: iap.currency || 'USD',
      transaction_type: 'in_game_purchase',
      status: 'completed',
      iap_ref: iapRef,
      notes: `IAP: ${iap.item_name || 'Unknown item'}`
    });

    // Update UserInventory
    const inventories = await base44.asServiceRole.entities.UserInventory.filter({ user_id: iap.user_id });
    if (inventories.length > 0) {
      const inv = inventories[0];
      const items = inv.items || [];
      items.push({ product_id: iap.product_id, name: iap.item_name, acquired_at: new Date().toISOString(), type: iap.item_type || 'consumable' });
      await base44.asServiceRole.entities.UserInventory.update(inv.id, { items });
    } else {
      await base44.asServiceRole.entities.UserInventory.create({
        user_id: iap.user_id,
        items: [{ product_id: iap.product_id, name: iap.item_name, acquired_at: new Date().toISOString(), type: iap.item_type || 'consumable' }]
      });
    }

    // Update VirtualCurrency if it's a currency purchase
    if (iap.item_type === 'virtual_currency' && currencyAmount > 0) {
      const vcs = await base44.asServiceRole.entities.VirtualCurrency.filter({ user_id: iap.user_id });
      if (vcs.length > 0) {
        await base44.asServiceRole.entities.VirtualCurrency.update(vcs[0].id, {
          balance: (vcs[0].balance || 0) + currencyAmount
        });
      } else {
        await base44.asServiceRole.entities.VirtualCurrency.create({
          user_id: iap.user_id,
          balance: currencyAmount,
          currency_type: 'coins'
        });
      }
    }

    // Send confirmation notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: iap.user_id,
      type: 'purchase_confirmed',
      title: `✅ Purchase Confirmed: ${iap.item_name || 'Item'}`,
      message: `Your in-app purchase of $${iap.price || 0} has been processed. Enjoy your ${iap.item_name || 'item'}!`,
      is_read: false
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});