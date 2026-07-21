import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Automates: daily platform health checks, batch daily goal generation, smart payout scheduling,
// business client setup, payout advance engine, personalized offers expiry, dynamic pricing
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const results = {};
  const errors = {};
  const now = new Date().toISOString();

  const run = async (key, fn, payload = {}) => {
    try {
      results[key] = await base44.asServiceRole.functions.invoke(fn, payload);
    } catch (e) {
      errors[key] = e.message;
      console.warn(`[HealthEngine] ${key} failed: ${e.message}`);
    }
  };

  try {
    // 1. Batch daily goal generation
    await run('daily_goals', 'batchDailyGoalGenerator', {});
    await run('ai_daily_goals', 'generateAIDailyGoal', { batch: true });

    // 2. Payout scheduling
    await run('smart_payout_scheduler', 'smartPayoutScheduler', {});
    await run('ai_payout_scheduler', 'aiPayoutScheduler', {});
    await run('ai_payout_scheduler_engine', 'aiPayoutSchedulerEngine', {});
    await run('ai_payout_advance', 'aiPayoutAdvanceEngine', {});

    // 3. Business client setup
    await run('business_client_setup', 'autoBusinessClientSetup', {});
    await run('register_business_client', 'autoRegisterBusinessClient', {});

    // 4. Verify pending business clients
    const pendingClients = await base44.asServiceRole.entities.BusinessClient.filter({ account_status: 'pending' }).catch(() => []);
    let clientsVerified = 0;
    for (const client of pendingClients.slice(0, 10)) {
      await base44.asServiceRole.functions.invoke('verifyBusinessClient', { client_id: client.id }).catch(() => {});
      clientsVerified++;
    }
    results.business_clients_verified = clientsVerified;

    // 5. Expire personalized offers
    const activeOffers = await base44.asServiceRole.entities.PersonalizedOffer.filter({ status: 'active' }).catch(() => []);
    let offersExpired = 0;
    for (const offer of activeOffers) {
      if (offer.expires_at && offer.expires_at < now) {
        await base44.asServiceRole.entities.PersonalizedOffer.update(offer.id, { status: 'expired' }).catch(() => {});
        offersExpired++;
      }
    }
    results.personalized_offers_expired = offersExpired;

    // 6. Dynamic pricing models count
    const pricingModels = await base44.asServiceRole.entities.DynamicPricing.list('-updated_date', 20).catch(() => []);
    results.dynamic_pricing_models = pricingModels.length;

    // 7. Batch game recommendations
    await run('game_recommendations', 'batchGameRecommendations', {});

    // 8. Payout optimization
    await run('payout_optimizer', 'aiPayoutOptimizer', {});
    await run('payout_insight', 'aiPayoutInsight', {});
    await run('payout_fraud_monitor', 'fraudPayoutMonitor', {});
    await run('payout_recommendations', 'autoPayoutRecommendations', {});

    // 9. Global settings version
    const globalSettings = await base44.asServiceRole.entities.GlobalSettings.list('-updated_date', 1).catch(() => []);
    results.global_settings_version = globalSettings[0]?.version || 'unknown';

    // 10. UX tracking
    await run('ux_sessions', 'uxSessionRecorder', { batch: true });
    await run('ux_analysis', 'uxAnalysisEngine', {});

    return Response.json({ success: true, results, errors: Object.keys(errors).length > 0 ? errors : undefined });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});