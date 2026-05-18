import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    if (event?.type !== 'update') return Response.json({ ok: true });
    const item = data;
    const oldStatus = old_data?.status;
    const newStatus = item.status;
    if (oldStatus === newStatus) return Response.json({ ok: true });

    if (newStatus === 'on_sale' || newStatus === 'low_stock') {
      const products = await base44.asServiceRole.entities.Product.filter({ id: item.product_id });
      const product = products[0];
      const label = newStatus === 'on_sale' ? '🔥 ON SALE' : '⚠️ LOW STOCK';

      await base44.asServiceRole.entities.Notification.create({
        user_id: item.user_id,
        type: 'wishlist_action_needed',
        title: `${label}: "${product?.name || 'Wishlist Item'}" needs your attention!`,
        message: `Your wishlisted item is now ${newStatus === 'on_sale' ? 'on sale' : 'running low on stock'}. ${item.user_balance >= (product?.price || 0) ? 'You have enough balance to buy it now!' : 'Earn a bit more and you can grab it!'}`,
        is_read: false
      });

      // If user has enough balance, suggest purchase
      if (item.user_balance >= (product?.price || 0)) {
        await base44.asServiceRole.entities.PersonalizedOffer.create({
          user_id: item.user_id,
          offer_type: 'wishlist_purchase_ready',
          product_id: item.product_id,
          message: `You can buy "${product?.name}" right now with your balance!`,
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
          status: 'active'
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});