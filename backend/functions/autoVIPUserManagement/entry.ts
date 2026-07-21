import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Identify and manage VIP users
    const topEarners = await base44.asServiceRole.entities.User.filter({
      total_earnings: { $gte: 1000 }
    }, '-total_earnings', 50);

    const vipUpdates = [];

    for (const topUser of topEarners) {
      // Check if user has VIP status
      if (!topUser.is_vip) {
        // Auto-promote to VIP
        await base44.auth.updateMe({
          is_vip: true,
          vip_level: topUser.total_earnings > 5000 ? 'platinum' : 'gold'
        });

        // Assign VIP perks
        const perks = topUser.total_earnings > 5000
          ? ['early_access', 'priority_support', 'bonus_surveys', 'exclusive_games']
          : ['priority_support', 'bonus_surveys'];

        await base44.asServiceRole.entities.TieredMembership.create({
          user_id: topUser.id,
          tier: topUser.total_earnings > 5000 ? 'platinum' : 'gold',
          perks,
          auto_promoted: true
        });

        // Send welcome email
        await base44.integrations.Core.SendEmail({
          to: topUser.email,
          subject: '🌟 Welcome to VIP!',
          body: `You've been promoted to ${topUser.total_earnings > 5000 ? 'Platinum' : 'Gold'} VIP status! Enjoy exclusive perks.`
        });

        vipUpdates.push({
          user_id: topUser.id,
          tier: topUser.total_earnings > 5000 ? 'platinum' : 'gold'
        });
      }
    }

    return Response.json({ success: true, promoted: vipUpdates.length, vipUpdates });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});