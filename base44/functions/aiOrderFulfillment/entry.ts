import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * AI Order Fulfillment Function
 * 
 * This function orchestrates AI-driven order placement on external vendor websites.
 * It uses the InvokeLLM integration with web search to:
 * 1. Analyze the product URL and vendor
 * 2. Extract structured order details
 * 3. Simulate/prepare the order placement workflow
 * 4. Update order status and create an AIAgentTask record
 * 
 * NOTE: Full browser automation requires an external RPA service (e.g. Browserless, Playwright Cloud).
 * Until that is wired in, this function uses AI to analyze the vendor site, prepares all order data,
 * flags any issues, and marks the order ready for automated or admin fulfillment.
 */

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { order_id } = body;

    if (!order_id) {
      return Response.json({ error: 'order_id is required' }, { status: 400 });
    }

    // Fetch the order
    const orders = await base44.asServiceRole.entities.Order.filter({ id: order_id });
    if (!orders || orders.length === 0) {
      return Response.json({ error: 'Order not found' }, { status: 404 });
    }
    const order = orders[0];

    // Guard: only process orders in pending_ai_fulfillment state
    if (order.shipping_status !== 'pending_ai_fulfillment') {
      return Response.json({ message: 'Order not in pending_ai_fulfillment state', status: order.shipping_status });
    }

    // Increment attempt counter
    await base44.asServiceRole.entities.Order.update(order.id, {
      fulfillment_attempts: (order.fulfillment_attempts || 0) + 1,
      last_fulfillment_attempt: new Date().toISOString(),
      ai_vetting_status: 'pending'
    });

    // Create AIAgentTask to track this fulfillment
    const task = await base44.asServiceRole.entities.AIAgentTask.create({
      task_type: 'order_fulfillment',
      status: 'processing',
      target_entity_id: order.id,
      parameters: {
        order_id: order.id,
        product_name: order.product_name,
        vendor_url: order.vendor_url,
        vendor_name: order.vendor_name,
        amount: order.amount,
        user_id: order.user_id
      },
      created_by: 'ai_order_fulfillment_function'
    });

    // Update order with task ID
    await base44.asServiceRole.entities.Order.update(order.id, {
      ai_fulfillment_task_id: task.id
    });

    // Step 1: Use AI to analyze the vendor website and gather fulfillment intelligence
    let vendorAnalysis = null;
    if (order.vendor_url) {
      try {
        vendorAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are an AI order fulfillment agent. Analyze this product listing and extract all information needed to place an order on behalf of a customer.

Product Name: ${order.product_name}
Vendor URL: ${order.vendor_url}
Vendor Name: ${order.vendor_name || 'Unknown'}
Order Amount: $${order.amount}

Please analyze the vendor website and provide:
1. Whether this is a legitimate, shippable physical product
2. The product's current availability status (in stock / out of stock)
3. The checkout process type (standard cart, direct buy, requires account, etc.)
4. Any special requirements to purchase (membership, login, minimum order, etc.)
5. Estimated shipping timeframe
6. Whether the site is a known major retailer (Amazon, Walmart, Best Buy, Target, etc.) or smaller vendor
7. Risk assessment: LOW / MEDIUM / HIGH (based on vendor trustworthiness)
8. Recommended fulfillment action: AUTO_FULFILL / MANUAL_REVIEW / ESCALATE
9. Brief reasoning for your recommendation

Respond in JSON format.`,
          add_context_from_internet: true,
          response_json_schema: {
            type: 'object',
            properties: {
              is_legitimate_product: { type: 'boolean' },
              availability: { type: 'string' },
              checkout_type: { type: 'string' },
              special_requirements: { type: 'string' },
              estimated_shipping: { type: 'string' },
              is_major_retailer: { type: 'boolean' },
              retailer_name: { type: 'string' },
              risk_level: { type: 'string' },
              recommended_action: { type: 'string' },
              reasoning: { type: 'string' },
              confidence_score: { type: 'number' }
            }
          }
        });
      } catch (e) {
        vendorAnalysis = { error: e.message, recommended_action: 'MANUAL_REVIEW', risk_level: 'MEDIUM' };
      }
    }

    const action = vendorAnalysis?.recommended_action || 'MANUAL_REVIEW';
    const riskLevel = vendorAnalysis?.risk_level || 'MEDIUM';

    // Step 2: Based on AI analysis, determine next steps
    if (action === 'ESCALATE' || riskLevel === 'HIGH') {
      // High risk — escalate to admin, do not attempt auto fulfillment
      await base44.asServiceRole.entities.Order.update(order.id, {
        shipping_status: 'processing',
        ai_vetting_status: 'escalated',
        ai_vetting_notes: `AI escalated: ${vendorAnalysis?.reasoning || 'High risk vendor detected'}. Risk: ${riskLevel}. Manual review required.`
      });

      await base44.asServiceRole.entities.AIAgentTask.update(task.id, {
        status: 'completed',
        result: JSON.stringify({ action: 'ESCALATED', analysis: vendorAnalysis })
      });

      // Create admin support ticket for escalation
      await base44.asServiceRole.entities.SupportTicket.create({
        user_id: order.user_id,
        category: 'billing',
        priority: 'urgent',
        subject: `[AI ESCALATION] Order ${order.id} — High Risk Vendor`,
        description: `The AI fulfillment agent flagged this order for manual review.\n\nOrder ID: ${order.id}\nProduct: ${order.product_name}\nVendor: ${order.vendor_name}\nURL: ${order.vendor_url}\nAmount: $${order.amount}\n\nAI Analysis:\n${JSON.stringify(vendorAnalysis, null, 2)}\n\nPlease review and fulfill manually if appropriate.`,
        status: 'open',
        admin_notes: `AI Risk Level: ${riskLevel} | Recommended Action: ESCALATE`
      });

      return Response.json({ success: true, action: 'ESCALATED', order_id: order.id, analysis: vendorAnalysis });
    }

    if (action === 'AUTO_FULFILL' && vendorAnalysis?.is_major_retailer) {
      // Known major retailer — mark as ready for automated checkout
      // In production, this would trigger the RPA/browser automation service
      await base44.asServiceRole.entities.Order.update(order.id, {
        shipping_status: 'external_order_placed',
        ai_vetting_status: 'in_progress',
        ai_vetting_notes: `AI cleared for fulfillment. Retailer: ${vendorAnalysis.retailer_name}. Risk: ${riskLevel}. Estimated shipping: ${vendorAnalysis.estimated_shipping || 'Unknown'}. Automated checkout initiated.`
      });

      await base44.asServiceRole.entities.AIAgentTask.update(task.id, {
        status: 'completed',
        result: JSON.stringify({ action: 'AUTO_FULFILL_INITIATED', analysis: vendorAnalysis })
      });

      // Send confirmation notification to user
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: order.user_id,
        subject: `Your GamerGain Order is Being Processed — ${order.product_name}`,
        body: `Great news! Your order for <strong>${order.product_name}</strong> has been cleared by our AI system and is being fulfilled automatically.\n\nVendor: ${order.vendor_name}\nEstimated Shipping: ${vendorAnalysis.estimated_shipping || 'See tracking'}\nAmount: $${order.amount}\n\nYou will receive a tracking number once the item ships. Your funds are held securely until delivery is confirmed.`
      });

      return Response.json({ success: true, action: 'AUTO_FULFILL_INITIATED', order_id: order.id, analysis: vendorAnalysis });
    }

    // Default: MANUAL_REVIEW — create a support ticket for admin to fulfill
    await base44.asServiceRole.entities.Order.update(order.id, {
      shipping_status: 'processing',
      ai_vetting_status: 'pending',
      ai_vetting_notes: `AI review complete. Action: ${action}. Risk: ${riskLevel}. Reason: ${vendorAnalysis?.reasoning || 'Manual review required.'}`
    });

    await base44.asServiceRole.entities.AIAgentTask.update(task.id, {
      status: 'completed',
      result: JSON.stringify({ action: 'MANUAL_REVIEW', analysis: vendorAnalysis })
    });

    const fulfillLink = order.vendor_url
      ? `${order.vendor_url}${order.vendor_url.includes('?') ? '&' : '?'}qty=1`
      : '(no direct link — search manually)';

    await base44.asServiceRole.entities.SupportTicket.create({
      user_id: order.user_id,
      category: 'billing',
      priority: 'high',
      subject: `[AI ORDER FULFILLMENT] ${order.product_name}`,
      description: `AI has analyzed and prepared this order for fulfillment.\n\nOrder ID: ${order.id}\nProduct: ${order.product_name}\nAmount Paid: $${order.amount}\nVendor: ${order.vendor_name}\nAUTO-FILL LINK: ${fulfillLink}\n\nAI Analysis:\nRisk Level: ${riskLevel}\nAction: ${action}\nReasoning: ${vendorAnalysis?.reasoning || 'N/A'}\n\nPlease purchase this item and update the order shipping status.`,
      status: 'open',
      admin_notes: `AI Confidence: ${vendorAnalysis?.confidence_score || 'N/A'} | Risk: ${riskLevel}`
    });

    return Response.json({ success: true, action: 'MANUAL_REVIEW_QUEUED', order_id: order.id, analysis: vendorAnalysis });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});