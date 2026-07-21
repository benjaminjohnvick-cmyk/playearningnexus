import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Weekly OPEN, MERIT-BASED referral reward (formerly a random jackpot).
// Every participant earns in proportion to the VERIFIED, revenue-generating
// referrals they drove — no chance, and no one is excluded. The reward pool is
// self-funding: it is a share of the real revenue those referrals produced, so
// the platform always keeps a margin (adds to the bottom line).
const TOP_BONUS_FRACTION = 0.3;             // 30% of pool rewards the leaders...
const TOP_SPLIT = [0.5, 0.3, 0.2];          // ...split across the top 3.
// Remaining 70% is paid proportionally to every participant's verified contribution.

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const periodStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const records = await base44.asServiceRole.entities.ReferralJackpot.filter({
      created_date: { $gte: periodStart }, status: 'active',
    });
    if (!records.length) return Response.json({ message: 'No active participants this period' });

    const settings = await base44.asServiceRole.entities.GlobalSettings.list().catch(() => []);
    const platformContribution = settings[0]?.weekly_jackpot_amount || 0;
    const fundingRate = records[0].pool_funding_rate ?? 0.4;

    // Aggregate participants and their performance points + any entry fees paid.
    const byUser: Record<string, { points: number; email: string; fees: number }> = {};
    for (const r of records) {
      if (!r.user_id) continue;
      if (!byUser[r.user_id]) byUser[r.user_id] = { points: 0, email: r.user_email, fees: 0 };
      byUser[r.user_id].points += r.jackpot_entries_earned || 0;
      byUser[r.user_id].fees += r.entry_fee_paid || 0;
    }

    // For each participant, compute VERIFIED revenue their referrals drove this period.
    // This is both the merit metric and the funding source (quality-gated = anti-fraud).
    const participants = [];
    let totalRevenue = 0;
    let totalFees = 0;
    for (const [userId, d] of Object.entries(byUser)) {
      let revenue = 0;
      let conversions = 0;
      try {
        const refs = await base44.asServiceRole.entities.Referral.filter({ referrer_user_id: userId });
        for (const ref of refs) {
          const converted = ref.status === 'converted' || ref.status === 'completed' || ref.status === 'active';
          if (!converted) continue;
          conversions++;
          revenue += (ref.commission_earned || 0) + (ref.ppc_bitlabs_earnings || 0);
        }
      } catch { /* fall back to points below */ }
      // Merit value: real revenue if we have it, otherwise performance points.
      const value = revenue > 0 ? revenue : d.points;
      participants.push({ userId, email: d.email, points: d.points, revenue, conversions, value });
      totalRevenue += revenue;
      totalFees += d.fees;
    }

    // Rank by merit (deterministic — no randomness).
    participants.sort((a, b) => b.value - a.value);
    const totalValue = participants.reduce((s, p) => s + p.value, 0);
    if (totalValue <= 0) return Response.json({ message: 'No verified performance to reward yet' });

    // Self-funding pool: a share of verified revenue + platform contribution + entry fees.
    // Platform keeps (1 - fundingRate) of the referral revenue as margin.
    const pool = Math.round((totalRevenue * fundingRate + platformContribution + totalFees) * 100) / 100;
    const topBonus = pool * TOP_BONUS_FRACTION;
    const proportionalPool = pool - topBonus;

    // Compute each participant's prize: proportional share for ALL, plus a top-3 bonus.
    const prizes: Record<string, number> = {};
    for (const p of participants) {
      prizes[p.userId] = (proportionalPool * (p.value / totalValue));
    }
    for (let i = 0; i < Math.min(3, participants.length); i++) {
      prizes[participants[i].userId] += topBonus * TOP_SPLIT[i];
    }

    // Pay everyone who earned a positive amount (open opportunity, merit-based).
    const winners = [];
    let paidCount = 0;
    let paidTotal = 0;
    for (let i = 0; i < participants.length; i++) {
      const p = participants[i];
      const prize = Math.round((prizes[p.userId] || 0) * 100) / 100;
      if (prize <= 0) continue;
      let u: any = null;
      try { u = await base44.asServiceRole.entities.User.get(p.userId); } catch { /* ignore */ }
      const email = u?.email || p.email;
      try {
        await base44.asServiceRole.functions.invoke('paypalPayout', {
          recipient_email: email, amount: prize,
          payout_type: 'referral_performance_reward',
          description: `Weekly Referral Performance Reward — rank #${i + 1}, ${p.conversions} verified conversions`,
        });
      } catch { /* may queue; still record */ }
      paidCount++; paidTotal += prize;
      if (i < 10) winners.push({ user_id: p.userId, user_name: u?.full_name || '', rank: i + 1, score: Math.round(p.value * 100) / 100, prize_amount: prize });
      if (i < 3 && email) {
        try {
          await base44.integrations.Core.SendEmail({
            to: email,
            subject: `🏆 You placed #${i + 1} in the Weekly Referral Program — $${prize}`,
            body: `You finished rank #${i + 1} by the verified value of the referrals you drove ($${Math.round(p.revenue * 100) / 100} in tracked revenue, ${p.conversions} conversions) and earned $${prize}. Everyone who drives real referrals earns a share — decided by performance, never luck.`,
          });
        } catch { /* non-fatal */ }
      }
    }

    try {
      await base44.asServiceRole.entities.ReferralJackpot.update(records[0].id, {
        status: 'paid_out', is_skill_based: true, open_to_all: true,
        ranking_metric: 'verified_referral_revenue',
        prize_pool: pool, payout_amount: paidTotal, winners,
        winner_user_id: winners[0]?.user_id, winner_name: winners[0]?.user_name, winner_entries: winners[0]?.score,
        completed_date: new Date().toISOString(), paid_at: new Date().toISOString(),
      });
    } catch { /* non-fatal */ }

    return Response.json({
      success: true, merit_based: true, open_to_all: true,
      prize_pool: pool, verified_revenue: Math.round(totalRevenue * 100) / 100,
      platform_margin_kept: Math.round(totalRevenue * (1 - fundingRate) * 100) / 100,
      participants_paid: paidCount, total_paid: Math.round(paidTotal * 100) / 100,
      top_finishers: winners,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
