import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Automates: order fulfillment, status updates, tracking, fund release, vetting, delivery confirmation
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};
    const now = new Date().toISOString();

    // 1. Pick up new orders awaiting AI fulfillment
    const pendingFulfillment = await base44.asServiceRole.entities.Order.filter({
      shipping_status: 'pending_ai_fulfillment',
      ai_vetting_status: 'not_started'
    }, '-created_date', 20);
    let fulfillmentStarted = 0;
    for (const order of pendingFulfillment) {
      await base44.asServiceRole.entities.Order.update(order.id, {
        ai_vetting_status: 'pending',
        shipping_status: 'processing',
        fulfillment_attempts: (order.fulfillment_attempts || 0) + 1,
        last_fulfillment_attempt: now
      });
      // Trigger AI order vetting
      await base44.asServiceRole.functions.invoke('aiOrderVetting', { order_id: order.id });
      fulfillmentStarted++;
    }
    results.fulfillment_started = fulfillmentStarted;

    // 2. Process vetted orders — trigger AI fulfillment
    const vettedOrders = await base44.asServiceRole.entities.Order.filter({
      ai_vetting_status: 'verified',
      shipping_status: 'processing'
    }, '-created_date', 20);
    let fulfillmentTriggered = 0;
    for (const order of vettedOrders) {
      await base44.asServiceRole.functions.invoke('aiOrderFulfillment', { order_id: order.id });
      fulfillmentTriggered++;
    }
    results.fulfillment_triggered = fulfillmentTriggered;

    // 3. Auto-approve large purchases after vetting
    const largeOrders = await base44.asServiceRole.entities.Order.filter({
      ai_vetting_status: 'pending'
    }, '-created_date', 10);
    for (const order of largeOrders) {
      if (order.amount >= 100) {
        await base44.asServiceRole.functions.invoke('autoLargePurchaseApproval', { order_id: order.id });
      }
    }
    results.large_purchases_reviewed = largeOrders.length;

    // 4. Check delivered orders — release funds
    const deliveredOrders = await base44.asServiceRole.entities.Order.filter({
      shipping_status: 'delivered',
      funds_released: false
    }, '-created_date', 50);
    let fundsReleased = 0;
    for (const order of deliveredOrders) {
      const deliveredDaysAgo = order.delivered_date
        ? (Date.now() - new Date(order.delivered_date).getTime()) / 86400000
        : 0;
      if (deliveredDaysAgo >= 3) { // 3-day hold after delivery
        await base44.asServiceRole.entities.Order.update(order.id, {
          funds_released: true,
          funds_released_date: now
        });
        // Notify user
        await base44.asServiceRole.entities.Notification.create({
          user_id: order.user_id,
          type: 'order_delivered',
          title: '📦 Order Delivered!',
          message: `Your order for "${order.product_name}" has been delivered and confirmed.`,
          is_read: false,
          created_at: now
        });
        fundsReleased++;
      }
    }
    results.funds_released = fundsReleased;

    // 5. Notify users of shipping status updates
    const shippedOrders = await base44.asServiceRole.entities.Order.filter({
      shipping_status: 'external_order_shipped'
    }, '-updated_date', 20);
    for (const order of shippedOrders) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: order.user_id,
        type: 'order_shipped',
        title: '🚚 Your Order Has Shipped!',
        message: `"${order.product_name}" is on its way! Tracking: ${order.tracking_number || 'Pending'}`,
        is_read: false,
        created_at: now
      });
    }
    results.shipping_notifications_sent = shippedOrders.length;

    // 6. Retry failed fulfillments (max 3 attempts)
    const failedOrders = await base44.asServiceRole.entities.Order.filter({
      ai_vetting_status: 'failed'
    }, '-created_date', 10);
    let retriesTriggered = 0;
    for (const order of failedOrders) {
      if ((order.fulfillment_attempts || 0) < 3) {
        await base44.asServiceRole.entities.Order.update(order.id, {
          ai_vetting_status: 'pending',
          fulfillment_attempts: (order.fulfillment_attempts || 0) + 1,
          last_fulfillment_attempt: now
        });
        retriesTriggered++;
      } else {
        // Escalate after 3 failed attempts
        await base44.asServiceRole.entities.Order.update(order.id, { ai_vetting_status: 'escalated' });
        await base44.asServiceRole.entities.SupportTicket.create({
          user_id: order.user_id,
          subject: `Order Fulfillment Failed: ${order.product_name}`,
          description: `Order ${order.id} failed fulfillment after 3 attempts. Manual review required.`,
          status: 'open',
          priority: 'high',
          created_at: now
        });
      }
    }
    results.fulfillment_retries = retriesTriggered;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});