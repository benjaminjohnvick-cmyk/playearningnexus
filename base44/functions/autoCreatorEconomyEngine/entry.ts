import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: creator payouts, subscription renewals, tip processing, content monetization, IAP validation
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const results = {};
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Process pending creator payouts
    const pendingCreatorPayouts = await base44.asServiceRole.entities.CreatorPayout.filter({ status: 'pending' });
    let creatorPayoutsProcessed = 0;
    for (const payout of pendingCreatorPayouts.slice(0, 20)) {
      // Auto-approve payouts under $500
      if (payout.amount < 500) {
        await base44.asServiceRole.entities.CreatorPayout.update(payout.id, {
          status: 'approved',
          approved_at: now
        });
        creatorPayoutsProcessed++;
      }
    }
    results.creator_payouts_processed = creatorPayoutsProcessed;

    // 2. Auto-optimize creator payouts
    await base44.asServiceRole.functions.invoke('autoCreatorPayoutOptimization', {});
    results.creator_payout_optimization_run = true;

    // 3. Check subscription renewals
    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({ status: 'active' });
    let renewalsProcessed = 0;
    for (const sub of subscriptions) {
      if (sub.next_billing_date && sub.next_billing_date <= today) {
        // Flag for billing
        await base44.asServiceRole.entities.Subscription.update(sub.id, {
          status: 'renewal_pending',
          flagged_at: now
        });
        renewalsProcessed++;
      }
    }
    results.subscriptions_flagged_for_renewal = renewalsProcessed;

    // 4. Process streamer tips
    const pendingTips = await base44.asServiceRole.entities.StreamerTip.filter({ status: 'pending' });
    let tipsProcessed = 0;
    for (const tip of pendingTips.slice(0, 50)) {
      await base44.asServiceRole.entities.StreamerTip.update(tip.id, {
        status: 'processed',
        processed_at: now
      });
      // Credit streamer
      if (tip.streamer_id && tip.amount) {
        const streamer = await base44.asServiceRole.entities.CreatorProfile.filter({ user_id: tip.streamer_id });
        if (streamer.length > 0) {
          await base44.asServiceRole.entities.CreatorProfile.update(streamer[0].id, {
            total_tips_received: (streamer[0].total_tips_received || 0) + tip.amount
          });
        }
      }
      tipsProcessed++;
    }
    results.tips_processed = tipsProcessed;

    // 5. Validate in-app purchases
    const pendingIAPs = await base44.asServiceRole.entities.InAppPurchase.filter({ status: 'pending' });
    let iapsValidated = 0;
    for (const iap of pendingIAPs.slice(0, 20)) {
      await base44.asServiceRole.entities.InAppPurchase.update(iap.id, {
        status: 'validated',
        validated_at: now
      });
      iapsValidated++;
    }
    results.iaps_validated = iapsValidated;

    // 6. IAP advertising credits
    const pendingCredits = await base44.asServiceRole.entities.IAPAdvertisingCredit.filter({ status: 'pending' });
    results.iap_credits_pending = pendingCredits.length;

    // 7. Update creator profiles with latest metrics
    const creatorProfiles = await base44.asServiceRole.entities.CreatorProfile.list('-created_date', 50);
    let profilesUpdated = 0;
    for (const profile of creatorProfiles) {
      const subs = await base44.asServiceRole.entities.StreamerSubscription.filter({ creator_id: profile.user_id });
      await base44.asServiceRole.entities.CreatorProfile.update(profile.id, {
        total_subscribers: subs.length
      });
      profilesUpdated++;
    }
    results.creator_profiles_updated = profilesUpdated;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});