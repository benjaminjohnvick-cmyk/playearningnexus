import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user?.role || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { developer_id, period_start, period_end } = await req.json();

    if (!developer_id || !period_start || !period_end) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch all games for developer in period
    const games = await base44.asServiceRole.entities.Game.filter({
      developer_id,
      created_date: { $gte: period_start, $lte: period_end }
    });

    // Calculate total revenue from games
    const totalRevenue = games.reduce((sum, game) => sum + (game.total_revenue || 0), 0);

    // Fetch advertising credits for developer in period
    const adCredits = await base44.asServiceRole.entities.IAPAdvertisingCredit.filter({
      developer_id
    });

    const totalAdCredit = adCredits.reduce((sum, ad) => sum + (ad.total_advertising_credit || 0), 0);
    const adCreditUsed = adCredits.reduce((sum, ad) => sum + (ad.credit_used || 0), 0);

    // Calculate 50/50 split
    const developerShare = totalRevenue * 0.5;

    // Net payout = developer share (advertising credit is already accounted in IAPAdvertisingCredit)
    const netPayoutAmount = developerShare;

    // Create payout record
    const payout = await base44.asServiceRole.entities.DeveloperPayout.create({
      developer_id,
      period_start,
      period_end,
      total_revenue: totalRevenue,
      advertising_credit_earned: totalAdCredit,
      advertising_credit_used: adCreditUsed,
      developer_share_50_percent: developerShare,
      net_payout_amount: netPayoutAmount,
      status: 'calculated',
      calculated_at: new Date().toISOString()
    });

    return Response.json({
      success: true,
      payout: {
        id: payout.id,
        developer_id,
        total_revenue: totalRevenue,
        developer_share: developerShare,
        net_payout: netPayoutAmount,
        ad_credits: {
          earned: totalAdCredit,
          used: adCreditUsed,
          remaining: totalAdCredit - adCreditUsed
        }
      }
    });
  } catch (error) {
    console.error('Payout calculation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});