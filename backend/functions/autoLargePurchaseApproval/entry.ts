import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { order_id } = await req.json();

    if (!order_id) return Response.json({ error: 'Missing order_id' }, { status: 400 });

    const order = await base44.asServiceRole.entities.Order.get(order_id);
    const user = await base44.asServiceRole.entities.User.get(order.user_id);

    // Check if order requires manual review
    if (order.amount > 500) {
      // Large purchase: Run AI vetting
      const vettingResult = await base44.functions.invoke('aiOrderVetting', {
        order_id
      });

      if (vettingResult.data.ai_verdict === 'approve' && vettingResult.data.ai_confidence > 0.9) {
        // Auto-approve high-confidence orders
        await base44.asServiceRole.entities.Order.update(order_id, {
          ai_vetting_status: 'verified',
          shipping_status: 'external_order_placed'
        });

        // Notify user
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: '✅ Large Order Approved',
          body: `Your order for $${order.amount} has been approved and will be processed soon.`
        });

        return Response.json({ success: true, action: 'approved', confidence: vettingResult.data.ai_confidence });
      }
    }

    return Response.json({ success: true, action: 'pending_review' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});