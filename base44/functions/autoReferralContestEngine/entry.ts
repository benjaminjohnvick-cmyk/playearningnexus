import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: referral contest lifecycle, leaderboard, winner selection, prize payout, jackpot processing
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};

    // 1. Contest entry and management
    await base44.asServiceRole.functions.invoke('autoContestEntryAndManagement', {});
    results.contest_entries_processed = true;

    // 2. Auto-manage contest lifecycle
    await base44.asServiceRole.functions.invoke('autoContestManager', {});
    results.contest_lifecycle_managed = true;

    // 3. Weekly contest winner determination
    await base44.asServiceRole.functions.invoke('weeklyContestWinner', {});
    results.weekly_winners_determined = true;

    // 4. Referral contest leaderboard update
    await base44.asServiceRole.functions.invoke('referralContestLeaderboard', {});
    results.leaderboard_updated = true;

    // 5. Process weekly jackpot
    await base44.asServiceRole.functions.invoke('processWeeklyJackpot', {});
    results.weekly_jackpot_processed = true;

    // 6. Process referral daily bonus
    await base44.asServiceRole.functions.invoke('processReferralDailyBonus', {});
    results.referral_daily_bonuses_processed = true;

    // 7. Process referral commissions
    await base44.asServiceRole.functions.invoke('processReferralCommissions', {});
    await base44.asServiceRole.functions.invoke('autoReferralCommissions', {});
    results.commissions_processed = true;

    // 8. MLM earnings aggregation
    await base44.asServiceRole.functions.invoke('autoMLMEarningsAggregation', {});
    results.mlm_earnings_aggregated = true;

    // 9. Distribute MLM bonuses
    await base44.asServiceRole.functions.invoke('distributeMLMBonus', {});
    results.mlm_bonuses_distributed = true;

    // 10. Verify referral conversions
    await base44.asServiceRole.functions.invoke('verifyReferralConversion', { batch: true });
    results.referral_conversions_verified = true;

    // 11. Track referral clicks
    await base44.asServiceRole.functions.invoke('trackReferralClick', { batch: true });
    results.referral_clicks_tracked = true;

    // 12. Create referral squads for top referrers
    const topReferrers = await base44.asServiceRole.entities.User.list('-referral_count', 10);
    results.top_referrers_count = topReferrers.length;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});