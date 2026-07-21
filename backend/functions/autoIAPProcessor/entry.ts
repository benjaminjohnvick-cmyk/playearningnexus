import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (event?.type !== 'create') return Response.json({ ok: true });
    const iap = data;
    if (!iap?.user_id || !iap?.product_id) return Response.json({ ok: true });

    // Create Transaction record
    await base44.asServiceRole.entities.Transaction.create({
      user_id: iap.user_id,
      game_id: iap.game_id,
      product_id: iap.product_id,
      amount: iap.price || 0,
      currency: iap.currency || 'USD',
      transaction_type: 'in_game_purchase',
      status: 'completed',
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
    if (iap.item_type === 'virtual_currency' && iap.currency_amount) {
      const vcs = await base44.asServiceRole.entities.VirtualCurrency.filter({ user_id: iap.user_id });
      if (vcs.length > 0) {
        await base44.asServiceRole.entities.VirtualCurrency.update(vcs[0].id, {
          balance: (vcs[0].balance || 0) + iap.currency_amount
        });
      } else {
        await base44.asServiceRole.entities.VirtualCurrency.create({
          user_id: iap.user_id,
          balance: iap.currency_amount,
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