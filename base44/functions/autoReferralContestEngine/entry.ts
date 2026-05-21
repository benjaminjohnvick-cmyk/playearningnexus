import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: referral contest lifecycle, leaderboard, winner selection, prize payout, jackpot processing
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const results = {};
  const errors = [];

  const invoke = async (name, payload = {}) => {
    try {
      await base44.asServiceRole.functions.invoke(name, payload);
    } catch (e) {
      errors.push({ fn: name, error: e.message });
    }
  };

  // 1. Contest entry and management
  await invoke('autoContestEntryAndManagement');
  results.contest_entries_processed = true;

  // 2. Auto-manage contest lifecycle
  await invoke('autoContestManager');
  results.contest_lifecycle_managed = true;

  // 3. Weekly contest winner determination
  await invoke('weeklyContestWinner');
  results.weekly_winners_determined = true;

  // 4. Referral contest leaderboard update
  await invoke('referralContestLeaderboard');
  results.leaderboard_updated = true;

  // 5. Process weekly jackpot
  await invoke('processWeeklyJackpot');
  results.weekly_jackpot_processed = true;

  // 6. Process referral daily bonus
  await invoke('processReferralDailyBonus');
  results.referral_daily_bonuses_processed = true;

  // 7. Process referral commissions
  await invoke('processReferralCommissions');
  await invoke('autoReferralCommissions');
  results.commissions_processed = true;

  // 8. MLM earnings aggregation
  await invoke('autoMLMEarningsAggregation');
  results.mlm_earnings_aggregated = true;

  // 9. Distribute MLM bonuses
  await invoke('distributeMLMBonus');
  results.mlm_bonuses_distributed = true;

  // 10. Verify referral conversions
  await invoke('verifyReferralConversion', { batch: true });
  results.referral_conversions_verified = true;

  // 11. Track referral clicks
  await invoke('trackReferralClick', { batch: true });
  results.referral_clicks_tracked = true;

  // 12. Top referrers summary
  try {
    const topReferrers = await base44.asServiceRole.entities.User.list('-created_date', 10);
    results.top_referrers_count = topReferrers.length;
  } catch (e) {
    errors.push({ fn: 'top_referrers_fetch', error: e.message });
  }

  return Response.json({ success: true, results, errors });
});