import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Process pending AI fulfillment orders
    const pendingOrders = await base44.asServiceRole.entities.Order.filter({ shipping_status: 'pending_ai_fulfillment' });
    let fulfilled = 0;

    for (const order of pendingOrders) {
      if ((order.fulfillment_attempts || 0) >= 3) {
        await base44.asServiceRole.entities.Order.update(order.id, { shipping_status: 'cancelled', notes: 'Max fulfillment attempts reached' });
        continue;
      }
      await base44.asServiceRole.entities.Order.update(order.id, {
        fulfillment_attempts: (order.fulfillment_attempts || 0) + 1,
        last_fulfillment_attempt: new Date().toISOString(),
        ai_vetting_status: 'in_progress'
      });
      await base44.asServiceRole.functions.invoke('aiOrderFulfillment', { order_id: order.id });
      fulfilled++;
    }

    // Auto-release funds for delivered orders older than 7 days
    const deliveredOrders = await base44.asServiceRole.entities.Order.filter({ shipping_status: 'delivered', funds_released: false });
    let released = 0;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    for (const order of deliveredOrders) {
      const deliveredAt = order.delivered_date || order.updated_date;
      if (deliveredAt && deliveredAt < sevenDaysAgo) {
        await base44.asServiceRole.entities.Order.update(order.id, {
          funds_released: true,
          funds_released_date: new Date().toISOString()
        });
        released++;
      }
    }

    return Response.json({ success: true, fulfilled, released });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});