import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Daily operations: generate new daily challenges, refresh AI daily surveys,
// send streak reminders, expire old promo codes, clean up stale sessions
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const today = new Date().toISOString().split('T')[0];
    const results = [];

    // 1. Generate today's daily challenges if none exist
    const existingChallenges = await base44.asServiceRole.entities.DailyChallenge.filter({ date: today });
    if (existingChallenges.length === 0) {
      const challengeTypes = [
        { title: 'Survey Champion', desc: 'Complete 3 surveys today', xp: 75, type: 'surveys' },
        { title: 'Referral Star', desc: 'Share your referral link on 2 platforms', xp: 50, type: 'referral' },
        { title: 'Game Explorer', desc: 'Play a featured game for 10 minutes', xp: 40, type: 'gaming' },
        { title: 'Community Connector', desc: 'Leave a game review or rating', xp: 30, type: 'community' }
      ];
      for (const c of challengeTypes) {
        await base44.asServiceRole.entities.DailyChallenge.create({
          date: today,
          title: c.title,
          description: c.desc,
          xp_reward: c.xp,
          challenge_type: c.type,
          status: 'active',
          user_id: 'system',
          target_value: c.type === 'surveys' ? 3 : c.type === 'referral' ? 2 : 1
        });
      }
      results.push('daily_challenges_created');
    }

    // 2. Expire promo codes past their expiry date
    const now = new Date().toISOString();
    const expiredPromos = await base44.asServiceRole.entities.PromoCode.filter({ is_active: true });
    let expiredCount = 0;
    for (const promo of expiredPromos) {
      if (promo.expires_at && new Date(promo.expires_at) < new Date(now)) {
        await base44.asServiceRole.entities.PromoCode.update(promo.id, { is_active: false });
        expiredCount++;
      }
    }
    if (expiredCount > 0) results.push(`expired_${expiredCount}_promos`);

    // 3. Expire premium memberships past their expiry
    const activeMemberships = await base44.asServiceRole.entities.PremiumMembership.filter({ status: 'active' });
    for (const m of activeMemberships) {
      if (m.expires_at && new Date(m.expires_at) < new Date(now)) {
        await base44.asServiceRole.entities.PremiumMembership.update(m.id, { status: 'expired' });
      }
    }
    results.push('memberships_checked');

    // 4. Expire subscriptions past their renewal date
    const activeSubscriptions = await base44.asServiceRole.entities.Subscription.filter({ status: 'active' });
    for (const sub of activeSubscriptions) {
      if (sub.next_billing_date && new Date(sub.next_billing_date) < new Date(now)) {
        await base44.asServiceRole.entities.Subscription.update(sub.id, { status: 'expired' });
      }
    }
    results.push('subscriptions_checked');

    // 5. Close DailyChallenge from yesterday
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const yesterdayChallenges = await base44.asServiceRole.entities.DailyChallenge.filter({ date: yesterday, status: 'active' });
    for (const c of yesterdayChallenges) {
      await base44.asServiceRole.entities.DailyChallenge.update(c.id, { status: 'completed' });
    }
    results.push('yesterday_challenges_closed');

    // 6. Close stale UXSessionRecordings (>24h old, still pending)
    const staleUX = await base44.asServiceRole.entities.UXSessionRecording.filter({ fraud_analysis_status: 'pending' });
    for (const s of staleUX) {
      if (new Date() - new Date(s.created_date) > 24 * 60 * 60 * 1000) {
        await base44.asServiceRole.entities.UXSessionRecording.update(s.id, { fraud_analysis_status: 'clean' });
      }
    }
    results.push('stale_ux_sessions_cleaned');

    return Response.json({ ok: true, date: today, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});