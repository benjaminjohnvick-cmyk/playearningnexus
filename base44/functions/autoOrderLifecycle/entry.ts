import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const order = data;
    if (!order?.id) return Response.json({ ok: true });
    const user = order.user_id ? (await base44.asServiceRole.entities.User.filter({ id: order.user_id }))[0] : null;

    if (event?.type === 'create') {
      // Welcome confirmation email
      if (user?.email) {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `🛍️ Order Confirmed: ${order.product_name}`,
          body: `Your order for "${order.product_name}" has been placed successfully for $${order.amount}. We'll notify you when it ships!`
        });
      }
      await base44.asServiceRole.entities.Notification.create({
        user_id: order.user_id,
        type: 'order_placed',
        title: '🛍️ Order Placed!',
        message: `Your order for "${order.product_name}" ($${order.amount}) is confirmed and being processed.`,
        is_read: false
      });
      // Award XP for purchase
      if (order.user_id) {
        await base44.asServiceRole.entities.UserActivity.create({
          user_id: order.user_id,
          activity_type: 'purchase',
          points_earned: Math.floor((order.amount || 0) * 5),
          metadata: { order_id: order.id, product: order.product_name }
        });
      }
    }

    if (event?.type === 'update') {
      const oldStatus = old_data?.shipping_status;
      const newStatus = order.shipping_status;
      if (oldStatus === newStatus) return Response.json({ ok: true });

      const statusMessages = {
        external_order_placed: { title: '📦 Order Processing', msg: `Your order for "${order.product_name}" has been placed with the vendor.` },
        external_order_shipped: { title: '🚚 Order Shipped!', msg: `Your order for "${order.product_name}" has shipped! Tracking: ${order.tracking_number || 'TBD'}` },
        external_order_delivered: { title: '✅ Delivered!', msg: `Your order "${order.product_name}" has been delivered!` },
        delivered: { title: '✅ Delivered!', msg: `Your order "${order.product_name}" has been delivered. Enjoy!` },
        cancelled: { title: '❌ Order Cancelled', msg: `Your order for "${order.product_name}" has been cancelled. Refund will process within 3-5 days.` },
        shipped: { title: '🚚 Order Shipped!', msg: `"${order.product_name}" is on its way! Carrier: ${order.carrier || 'TBD'}. Tracking: ${order.tracking_number || 'TBD'}` }
      };

      const statusInfo = statusMessages[newStatus];
      if (statusInfo && order.user_id) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: order.user_id,
          type: 'order_status_update',
          title: statusInfo.title,
          message: statusInfo.msg,
          is_read: false
        });
        if (user?.email) {
          await base44.integrations.Core.SendEmail({
            to: user.email,
            subject: statusInfo.title,
            body: statusInfo.msg
          });
        }
      }

      // Funds released → record revenue transaction
      if (order.funds_released && !old_data?.funds_released) {
        await base44.asServiceRole.entities.Transaction.create({
          user_id: order.user_id,
          amount: order.amount,
          currency: 'USD',
          transaction_type: 'in_game_purchase',
          status: 'completed',
          notes: `Order fulfilled & funds released: ${order.product_name}`
        });
      }
    }

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});