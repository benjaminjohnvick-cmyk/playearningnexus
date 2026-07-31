import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";
import { getNumber } from "../../sdk/settings.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "calculateDeveloperPayout", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "calculateDeveloperPayout — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
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

    // Developer's cut of revenue (admin-adjustable; default 0.5 = the current 50/50 split).
    const devShareRate = await getNumber("DEVELOPER_REVENUE_SHARE", 0.5);
    const developerShare = totalRevenue * devShareRate;

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

    // B16 — record the PLATFORM's existing cut of developer revenue into the unified RevenueEvent ledger
    // (business side, never charged to players). This surfaces the cut in revenueReport WITHOUT changing
    // the economics — the developer's share is already set by DEVELOPER_REVENUE_SHARE above; we don't
    // deduct again.
    try {
      const { recordRevenue } = await import("../../sdk/revenue.ts");
      const platformCut = Math.max(0, totalRevenue - developerShare);
      if (platformCut > 0) await recordRevenue({ type: "dev_creator_cut", amount_usd: platformCut, business_id: developer_id, ref: payout.id, meta: { total_revenue: totalRevenue, dev_share_rate: devShareRate } });
    } catch { /* revenue logging is best-effort */ }

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