import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Calculates holistic Global Prestige score for a user (or all users).
 * Aggregates survey activity, game playtime, marketplace spend, referrals, streaks.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let callerIsAdmin = false;
    try { const u = await base44.auth.me(); callerIsAdmin = u?.role === 'admin'; } catch (_) { callerIsAdmin = true; }
    if (!callerIsAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { user_id } = body; // optional: single user

    const users = user_id
      ? [await base44.asServiceRole.entities.User.filter({ id: user_id }).then(r => r[0])]
      : await base44.asServiceRole.entities.User.list();

    const results = [];

    for (const user of users) {
      if (!user?.id) continue;

      const [responses, transactions, referrals, streakRecords, gameSessions, orders] = await Promise.all([
        base44.asServiceRole.entities.PPCSurveyResponse.filter({ user_id: user.id }, '-created_date', 500),
        base44.asServiceRole.entities.PPCTransaction.filter({ user_id: user.id }, '-created_date', 200),
        base44.asServiceRole.entities.Referral.filter({ referrer_id: user.id }, '-created_date', 200),
        base44.asServiceRole.entities.Streak.filter({ user_id: user.id }),
        base44.asServiceRole.entities.PPCSession.filter({ user_id: user.id }, '-created_date', 100),
        base44.asServiceRole.entities.Order.filter({ user_id: user.id }),
      ]);

      const completedSurveys = responses.filter(r => r.completed && !r.is_blocked).length;
      const totalEarnings = transactions.reduce((s, t) => s + (t.amount || 0), 0);
      const totalReferrals = referrals.length;
      const currentStreak = streakRecords[0]?.current_streak || 0;
      const totalGameMinutes = gameSessions.reduce((s, g) => s + (g.session_duration_minutes || 0), 0);
      const totalMarketplaceSpend = orders.reduce((s, o) => s + (o.amount || 0), 0);

      // Weighted scoring (max 1000 pts)
      const surveyScore = Math.min(300, completedSurveys * 2 + totalEarnings * 0.5);
      const gameScore = Math.min(200, totalGameMinutes * 0.15);
      const marketplaceScore = Math.min(200, totalMarketplaceSpend * 2);
      const referralScore = Math.min(200, totalReferrals * 10);
      const streakScore = Math.min(100, currentStreak * 3);

      const prestigeScore = Math.round(surveyScore + gameScore + marketplaceScore + referralScore + streakScore);

      const prestigeTier =
        prestigeScore >= 800 ? 'diamond' :
        prestigeScore >= 600 ? 'platinum' :
        prestigeScore >= 400 ? 'gold' :
        prestigeScore >= 200 ? 'silver' : 'bronze';

      // Fee discount: diamond=15%, platinum=10%, gold=6%, silver=3%, bronze=0%
      const feeDiscountPct =
        prestigeTier === 'diamond' ? 15 :
        prestigeTier === 'platinum' ? 10 :
        prestigeTier === 'gold' ? 6 :
        prestigeTier === 'silver' ? 3 : 0;

      // Unlocked survey pools by tier
      const unlockedPools = [];
      if (prestigeScore >= 200) unlockedPools.push('silver_pool');
      if (prestigeScore >= 400) unlockedPools.push('gold_pool');
      if (prestigeScore >= 600) unlockedPools.push('platinum_pool');
      if (prestigeScore >= 800) unlockedPools.push('diamond_pool');

      // AI insights
      let aiInsights = '';
      try {
        const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `A user has a Global Prestige score of ${prestigeScore}/1000 (${prestigeTier} tier).
Breakdown: Survey ${Math.round(surveyScore)}, Game ${Math.round(gameScore)}, Marketplace ${Math.round(marketplaceScore)}, Referral ${Math.round(referralScore)}, Streak ${Math.round(streakScore)}.
Their weakest area is ${['survey','game','marketplace','referral','streak'][
  [surveyScore/300, gameScore/200, marketplaceScore/200, referralScore/200, streakScore/100].indexOf(
    Math.min(surveyScore/300, gameScore/200, marketplaceScore/200, referralScore/200, streakScore/100)
  )
]}.
Write 1-2 sentences of personalized tips to help them level up, in second person, friendly tone.`,
        });
        aiInsights = typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult);
      } catch (_) { aiInsights = `You're ${prestigeTier} tier! Keep engaging to unlock exclusive survey pools and fee discounts.`; }

      // Upsert GlobalPrestige record
      const existing = await base44.asServiceRole.entities.GlobalPrestige.filter({ user_id: user.id });
      const data = {
        user_id: user.id,
        prestige_score: prestigeScore,
        prestige_tier: prestigeTier,
        survey_score: Math.round(surveyScore),
        gameplay_score: Math.round(gameScore),
        marketplace_score: Math.round(marketplaceScore),
        referral_score: Math.round(referralScore),
        streak_score: Math.round(streakScore),
        total_surveys_completed: completedSurveys,
        total_game_minutes: totalGameMinutes,
        total_marketplace_spend: totalMarketplaceSpend,
        total_referrals: totalReferrals,
        current_streak_days: currentStreak,
        fee_discount_pct: feeDiscountPct,
        unlocked_survey_pools: unlockedPools,
        last_calculated_at: new Date().toISOString(),
        ai_insights: aiInsights,
      };

      if (existing[0]) {
        await base44.asServiceRole.entities.GlobalPrestige.update(existing[0].id, data);
      } else {
        await base44.asServiceRole.entities.GlobalPrestige.create(data);
      }

      results.push({ user_id: user.id, prestige_score: prestigeScore, prestige_tier: prestigeTier });
    }

    return Response.json({ success: true, processed: results.length, results });
  } catch (error) {
    console.error('calculateGlobalPrestige error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});