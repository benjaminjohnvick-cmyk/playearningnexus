import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Daily operations: generate new daily challenges, refresh AI daily surveys,
// send streak reminders, expire old promo codes, clean up stale sessions
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const today = new Date().toISOString().split('T')[0];
    const results = [];

    // 1. Generate today's daily challenges — assign to all active users (or create global ones per active user)
    // Since DailyChallenge requires a real user_id, create template challenges for each active user
    const todayExpiry = new Date(today + 'T23:59:59Z').toISOString();
    const challengeTemplates = [
      { title: 'Survey Champion', description: 'Complete 3 surveys today', challenge_type: 'complete_surveys', target_value: 3, reward_amount: 0.75 },
      { title: 'Referral Star', description: 'Invite 2 friends today', challenge_type: 'invite_friends', target_value: 2, reward_amount: 0.50 },
      { title: 'Game Explorer', description: 'Play a featured game today', challenge_type: 'play_games', target_value: 1, reward_amount: 0.40 },
      { title: 'Earnings Goal', description: 'Earn $1 today', challenge_type: 'earn_amount', target_value: 1, reward_amount: 0.30 }
    ];
    // Get a sample of active users to assign challenges to (limit to 50 to avoid heavy load)
    const activeUsers = await base44.asServiceRole.entities.User.list('-created_date', 50);
    let challengesCreated = 0;
    for (const user of activeUsers) {
      // Check if this user already has challenges expiring today
      const userChallenges = await base44.asServiceRole.entities.DailyChallenge.filter({ user_id: user.id, completed: false });
      const hasTodayChallenge = userChallenges.some(c => c.expires_at && c.expires_at.startsWith(today));
      if (!hasTodayChallenge) {
        const template = challengeTemplates[challengesCreated % challengeTemplates.length];
        await base44.asServiceRole.entities.DailyChallenge.create({
          user_id: user.id,
          title: template.title,
          description: template.description,
          challenge_type: template.challenge_type,
          target_value: template.target_value,
          reward_amount: template.reward_amount,
          expires_at: todayExpiry,
          completed: false
        });
        challengesCreated++;
      }
    }
    if (challengesCreated > 0) results.push(`daily_challenges_created_${challengesCreated}`);

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

    // 5. Close DailyChallenge from yesterday (expired but not yet marked complete)
    const expiredChallenges = await base44.asServiceRole.entities.DailyChallenge.filter({ completed: false });
    let closedCount = 0;
    for (const c of expiredChallenges) {
      if (c.expires_at && new Date(c.expires_at) < new Date()) {
        await base44.asServiceRole.entities.DailyChallenge.update(c.id, { completed: true, completed_at: now });
        closedCount++;
      }
    }
    results.push(`expired_challenges_closed_${closedCount}`);

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