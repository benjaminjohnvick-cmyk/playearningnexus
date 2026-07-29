import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { recordAffiliateProgress } from "../../sdk/loyalty.ts";

// Automates: affiliate sale commission processing, streamer tip payouts, game voting tally,
// survey schedule execution, PPCSession closure/rewards, growth heatmap data collection,
// affiliate product management, survey recommendation matching
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const results = {};
    const now = new Date().toISOString();

    // 1. Process affiliate sales — award commissions
    const pendingAffiliateSales = await base44.asServiceRole.entities.AffiliateSale.filter({ commission_processed: false }, '-created_date', 30);
    let commissions = 0;
    for (const sale of pendingAffiliateSales) {
      const commission = (sale.sale_amount || 0) * (sale.commission_rate || 0.1);
      if (commission > 0 && sale.affiliate_user_id) {
        // CLAIM the sale first (atomic false→true) so a concurrent run can't also process it and
        // double-pay the commission. Only the run that wins the claim credits the affiliate.
        const claimed = await db.updateIf(
          "AffiliateSale", sale.id,
          { commission_processed: true, commission_amount: commission, commission_processed_at: now },
          { field: "commission_processed", equals: "false" },
        ).catch(() => null);
        if (!claimed) continue; // another run already processed this sale

        // If this affiliate is on the UPFRONT plan, their commission funds the vesting of their escrowed
        // grant (the platform keeps the commission; their reward is the released grant) — so DON'T also
        // credit it to their balance. recordAffiliateProgress returns null for a normal affiliate.
        const vested = await recordAffiliateProgress(sale.affiliate_user_id, commission).catch(() => null);
        if (vested) {
          await base44.asServiceRole.entities.Transaction.create({
            user_id: sale.affiliate_user_id,
            amount: commission,
            transaction_type: 'affiliate_vesting',
            status: 'completed',
            notes: `Commission $${commission} advanced upfront vesting (released $${vested.released_now})`
          }).catch(() => null);
        } else {
          // Normal affiliate: credit their commission atomically (compare-and-set).
          const newBal = await adjustUserBalance(sale.affiliate_user_id, commission).catch(() => null);
          if (newBal != null) {
            await base44.asServiceRole.entities.Transaction.create({
              user_id: sale.affiliate_user_id,
              amount: commission,
              transaction_type: 'revenue_share',
              status: 'completed',
              notes: `Affiliate commission for sale ${sale.id}`
            }).catch(() => null);
          }
        }
        commissions++;
      }
    }
    results.affiliate_commissions_processed = commissions;

    // 2. Process streamer tips — payout to streamers
    const pendingTips = await base44.asServiceRole.entities.StreamerTip.filter({ payout_processed: false }, '-created_date', 30);
    let tipsPaid = 0;
    for (const tip of pendingTips) {
      const streamerCut = (tip.amount || 0) * 0.8; // 80% to streamer
      if (streamerCut > 0 && tip.streamer_id) {
        await base44.asServiceRole.entities.Transaction.create({
          user_id: tip.streamer_id,
          amount: streamerCut,
          transaction_type: 'revenue_share',
          status: 'completed',
          notes: `Streamer tip payout`
        });
        await base44.asServiceRole.entities.StreamerTip.update(tip.id, {
          payout_processed: true,
          payout_amount: streamerCut,
          payout_at: now
        });
        // Notify streamer
        await base44.asServiceRole.entities.Notification.create({
          user_id: tip.streamer_id,
          type: 'points_earned',
          title: '💰 You received a tip!',
          message: `You earned $${streamerCut.toFixed(2)} from a tip.`,
          status: 'unread'
        });
        tipsPaid++;
      }
    }
    results.streamer_tips_paid = tipsPaid;

    // 3. Tally game votes
    const pendingVotes = await base44.asServiceRole.entities.GameVote.filter({ tallied: false }, '-created_date', 50);
    let votesTallied = 0;
    for (const vote of pendingVotes.slice(0, 30)) {
      await base44.asServiceRole.functions.invoke('gameVotingPipeline', { vote_id: vote.id });
      await base44.asServiceRole.entities.GameVote.update(vote.id, { tallied: true });
      votesTallied++;
    }
    results.game_votes_tallied = votesTallied;

    // 4. Execute due survey schedules
    const dueSchedules = await base44.asServiceRole.entities.SurveySchedule.filter({ status: 'scheduled' }, '-launch_datetime', 20);
    let schedulesExecuted = 0;
    for (const schedule of dueSchedules) {
      if (schedule.launch_datetime && new Date(schedule.launch_datetime) <= new Date()) {
        await base44.asServiceRole.functions.invoke('processSurveySchedules', { schedule_id: schedule.id });
        await base44.asServiceRole.functions.invoke('scheduleSurveyDistribution', { schedule_id: schedule.id });
        await base44.asServiceRole.entities.SurveySchedule.update(schedule.id, {
          status: 'completed'
        });
        schedulesExecuted++;
      }
    }
    results.survey_schedules_executed = schedulesExecuted;

    // 5. Close stale PPC sessions and award rewards
    const activePPCSessions = await base44.asServiceRole.entities.PPCSession.filter({ status: 'active' });
    let sessionsClosedAndRewarded = 0;
    for (const session of activePPCSessions) {
      const ageMinutes = (Date.now() - new Date(session.started_at || session.created_date).getTime()) / 60000;
      if (ageMinutes > 60) { // Close sessions older than 60 min
        await base44.asServiceRole.functions.invoke('processPPCSession', { session_id: session.id, action: 'close' });
        await base44.asServiceRole.entities.PPCSession.update(session.id, {
          status: 'completed',
          completed_at: now
        });
        sessionsClosedAndRewarded++;
      }
    }
    results.ppc_sessions_closed = sessionsClosedAndRewarded;

    // 6. Collect growth heatmap data
    const recentUsers = await base44.asServiceRole.entities.User.list('-created_date', 100);
    const today = now.split('T')[0];
    await base44.asServiceRole.entities.GrowthHeatmapData.create({
      date: today,
      country_code: 'US',
      new_users: recentUsers.filter(u => u.created_date?.startsWith(today)).length,
      total_users: recentUsers.length,
      collected_at: now
    }).catch(e => console.warn('[AffiliateStreamer] GrowthHeatmapData create failed:', e.message));
    results.growth_heatmap_data_collected = true;

    // 7. AI survey recommendations matching
    await base44.asServiceRole.functions.invoke('aiSurveyRecommendationEngine', {});
    results.survey_recommendations_matched = true;

    // 8. Affiliate product auto-update prices
    const affiliateProducts = await base44.asServiceRole.entities.AffiliateProduct.filter({ price_check_needed: true });
    let pricesChecked = 0;
    for (const product of affiliateProducts.slice(0, 20)) {
      await base44.asServiceRole.functions.invoke('aiPriceEngine', { product_id: product.id });
      await base44.asServiceRole.entities.AffiliateProduct.update(product.id, { price_check_needed: false, last_price_check: now });
      pricesChecked++;
    }
    results.affiliate_product_prices_updated = pricesChecked;

    // 9. Saved survey searches — refresh recommendations
    const savedSearches = await base44.asServiceRole.entities.SavedSurveySearch.list('-updated_date', 20);
    results.saved_survey_searches = savedSearches.length;

    // 10. Survey marketplace listing refresh
    const listings = await base44.asServiceRole.entities.SurveyMarketplaceListing.filter({ status: 'active' });
    results.active_marketplace_listings = listings.length;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});