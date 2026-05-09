import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * AI Order Vetting Function
 * 
 * Runs on a schedule to monitor external orders and verify delivery.
 * When delivery is confirmed and vetted, it releases the held funds.
 * 
 * Flow:
 * 1. Find all orders with shipping_status in [external_order_placed, external_order_shipped] AND funds_released = false
 * 2. For each, use AI to check tracking status (via tracking number / carrier API)
 * 3. If delivered and vetted → release funds, update order to completed
 * 4. If anomaly detected → escalate to admin
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (no auth) and manual admin invocation
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      isAdmin = user?.role === 'admin';
    } catch {
      // Called by scheduler — proceed with service role
    }

    // Fetch all orders pending vetting
    const allOrders = await base44.asServiceRole.entities.Order.filter({ funds_released: false });
    const pendingOrders = allOrders.filter(o =>
      ['external_order_placed', 'external_order_shipped', 'external_order_delivered'].includes(o.shipping_status)
      && ['pending', 'in_progress', 'not_started'].includes(o.ai_vetting_status || 'not_started')
    );

    if (pendingOrders.length === 0) {
      return Response.json({ message: 'No orders pending vetting', processed: 0 });
    }

    const results = [];

    for (const order of pendingOrders) {
      try {
        // Update vetting status to in_progress
        await base44.asServiceRole.entities.Order.update(order.id, {
          ai_vetting_status: 'in_progress'
        });

        // Build context for AI vetting
        const trackingInfo = order.tracking_number
          ? `Tracking Number: ${order.tracking_number}\nCarrier: ${order.carrier || 'Unknown'}\nTracking URL: ${order.tracking_url || 'N/A'}`
          : 'No tracking number available yet.';

        // Use AI to vet the order
        const vettingResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are an AI order vetting agent. Analyze the following order and determine its delivery status.

Order Details:
- Order ID: ${order.id}
- Product: ${order.product_name}
- Vendor: ${order.vendor_name}
- External Order ID: ${order.external_order_id || 'Not yet assigned'}
- Current Status: ${order.shipping_status}
- Amount: $${order.amount}
- Order Date: ${order.created_date}
- ${trackingInfo}

Your job:
1. Determine if this order has been successfully delivered
2. Check for any delivery anomalies (wrong address, failed delivery, package lost, etc.)
3. Assess whether GamerGain should release the held funds to complete the transaction
4. Provide a vetting decision

Decision options:
- RELEASE_FUNDS: Delivery confirmed, no anomalies, funds should be released
- CONTINUE_MONITORING: Still in transit or awaiting update, check again later
- ESCALATE: Anomaly detected (lost package, wrong item, dispute risk), admin must review
- REQUEST_TRACKING: No tracking available, needs admin to update tracking info

Be conservative — only recommend RELEASE_FUNDS when you are confident delivery is complete.`,
          add_context_from_internet: order.tracking_number ? true : false,
          response_json_schema: {
            type: 'object',
            properties: {
              delivery_status: { type: 'string' },
              anomaly_detected: { type: 'boolean' },
              anomaly_description: { type: 'string' },
              decision: { type: 'string' },
              confidence: { type: 'number' },
              reasoning: { type: 'string' },
              estimated_delivery_date: { type: 'string' }
            }
          }
        });

        const decision = vettingResult?.decision || 'CONTINUE_MONITORING';

        if (decision === 'RELEASE_FUNDS') {
          // Release funds — order is complete
          await base44.asServiceRole.entities.Order.update(order.id, {
            shipping_status: 'delivered',
            ai_vetting_status: 'verified',
            ai_vetting_notes: `AI verified delivery. ${vettingResult.reasoning || ''}. Confidence: ${vettingResult.confidence || 'N/A'}`,
            funds_released: true,
            funds_released_date: new Date().toISOString(),
            delivered_date: new Date().toISOString().split('T')[0]
          });

          // Notify user
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: order.user_id,
            subject: `Your order has been delivered — ${order.product_name}`,
            body: `Great news! Your GamerGain order for <strong>${order.product_name}</strong> has been confirmed as delivered by our AI verification system.\n\nYour transaction is now complete. Thank you for shopping with GamerGain!`
          });

          results.push({ order_id: order.id, decision: 'FUNDS_RELEASED', product: order.product_name });

        } else if (decision === 'ESCALATE') {
          await base44.asServiceRole.entities.Order.update(order.id, {
            ai_vetting_status: 'escalated',
            ai_vetting_notes: `AI escalated: ${vettingResult.anomaly_description || vettingResult.reasoning || 'Anomaly detected'}`
          });

          // Create admin ticket for anomaly
          await base44.asServiceRole.entities.SupportTicket.create({
            user_id: order.user_id,
            category: 'billing',
            priority: 'urgent',
            subject: `[AI VETTING ESCALATION] Order ${order.id} — Delivery Anomaly`,
            description: `The AI vetting agent detected an anomaly for order ${order.id}.\n\nProduct: ${order.product_name}\nTracking: ${order.tracking_number || 'N/A'}\nAnomaly: ${vettingResult.anomaly_description || 'Unknown'}\n\nReasoning: ${vettingResult.reasoning || 'N/A'}\n\nPlease review and resolve before releasing funds.`,
            status: 'open',
            admin_notes: `AI Confidence: ${vettingResult.confidence} | Decision: ESCALATE`
          });

          results.push({ order_id: order.id, decision: 'ESCALATED', product: order.product_name });

        } else if (decision === 'REQUEST_TRACKING') {
          await base44.asServiceRole.entities.Order.update(order.id, {
            ai_vetting_status: 'pending',
            ai_vetting_notes: 'Awaiting tracking information to proceed with vetting.'
          });

          await base44.asServiceRole.entities.SupportTicket.create({
            user_id: order.user_id,
            category: 'billing',
            priority: 'medium',
            subject: `[TRACKING NEEDED] Order ${order.id} — ${order.product_name}`,
            description: `AI vetting is blocked because no tracking number is available for order ${order.id}.\n\nProduct: ${order.product_name}\nVendor: ${order.vendor_name}\nExternal Order ID: ${order.external_order_id || 'Not assigned'}\n\nPlease update the tracking number so vetting can proceed.`,
            status: 'open'
          });

          results.push({ order_id: order.id, decision: 'TRACKING_REQUESTED', product: order.product_name });

        } else {
          // CONTINUE_MONITORING — update notes, keep monitoring
          await base44.asServiceRole.entities.Order.update(order.id, {
            ai_vetting_status: 'in_progress',
            ai_vetting_notes: `Monitoring: ${vettingResult.reasoning || 'In transit'}. Est. delivery: ${vettingResult.estimated_delivery_date || 'Unknown'}`
          });

          results.push({ order_id: order.id, decision: 'MONITORING', product: order.product_name });
        }

      } catch (orderError) {
        await base44.asServiceRole.entities.Order.update(order.id, {
          ai_vetting_status: 'failed',
          ai_vetting_notes: `Vetting error: ${orderError.message}`
        });
        results.push({ order_id: order.id, decision: 'ERROR', error: orderError.message });
      }
    }

    return Response.json({
      success: true,
      processed: pendingOrders.length,
      results
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});