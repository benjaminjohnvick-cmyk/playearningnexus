import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const node = data;
    if (!node?.user_id || event?.type !== 'update') return Response.json({ ok: true });

    const oldCredit = old_data?.website_credit_balance || 0;
    const newCredit = node.website_credit_balance || 0;
    const creditGained = newCredit - oldCredit;

    // Notify on meaningful credit increase (>= $1)
    if (creditGained >= 1) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: node.user_id,
        type: 'website_credit_earned',
        title: `💳 +$${creditGained.toFixed(2)} Website Credit Earned!`,
        message: `You earned $${creditGained.toFixed(2)} in platform credit from your referral network! Total available: $${newCredit.toFixed(2)}. Use it in the store or toward your wishlist.`,
        is_read: false
      });
    }

    // Milestone notifications at $5, $10, $25, $50, $100
    const milestones = [5, 10, 25, 50, 100];
    for (const milestone of milestones) {
      if (newCredit >= milestone && oldCredit < milestone) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: node.user_id,
          type: 'website_credit_milestone',
          title: `🎉 $${milestone} Website Credit Milestone!`,
          message: `You've accumulated $${milestone} in platform credit from your MLM referral network! Redeem it in the store today.`,
          is_read: false
        });

        // Create ActivityFeedItem for milestone
        await base44.asServiceRole.entities.ActivityFeedItem.create({
          user_id: node.user_id,
          activity_type: 'achievement',
          title: `💳 Earned $${milestone} in Website Credit`,
          description: `MLM referral network milestone reached!`,
          icon: '💳',
          is_public: true
        });
        break;
      }
    }

    return Response.json({ ok: true, credit_gained: creditGained });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});