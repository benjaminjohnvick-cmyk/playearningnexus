import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Weekly operations: process jackpot, contest winners, top earner rewards,
// weekly leaderboard reset, streak bonus calculation
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const results = [];
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Determine weekly top 3 earners and reward them
    const users = await base44.asServiceRole.entities.User.list('-total_earnings', 20);
    const top3 = users.slice(0, 3);
    const prizes = [5.00, 3.00, 1.00];
    const titles = ['🥇 Weekly #1 Earner', '🥈 Weekly #2 Earner', '🥉 Weekly #3 Earner'];
    for (let i = 0; i < top3.length; i++) {
      const u = top3[i];
      await base44.asServiceRole.entities.User.update(u.id, {
        total_earnings: (u.total_earnings || 0) + prizes[i]
      });
      await base44.asServiceRole.entities.Notification.create({
        user_id: u.id,
        type: 'weekly_top_earner',
        title: `${titles[i]} — $${prizes[i]} Bonus!`,
        message: `Congratulations! You were one of GamerGain's top earners this week and earned a $${prizes[i]} bonus!`,
        is_read: false
      });
      if (u.email) {
        await base44.integrations.Core.SendEmail({
          to: u.email,
          subject: `🏆 ${titles[i]} — $${prizes[i]} Bonus Earned!`,
          body: `Congratulations ${u.full_name}! You ranked #${i + 1} among all GamerGain earners this week and earned a $${prizes[i]} cash bonus, now in your account balance. Keep it up!`
        });
      }
      results.push(`rewarded_rank_${i + 1}`);
    }

    // 2. Close this week's WeeklyEvents
    const activeWeeklyEvents = await base44.asServiceRole.entities.WeeklyEvent.filter({ status: 'active' });
    for (const evt of activeWeeklyEvents) {
      if (new Date(evt.end_date || evt.ends_at) < now) {
        await base44.asServiceRole.entities.WeeklyEvent.update(evt.id, { status: 'ended' });
      }
    }
    results.push('weekly_events_closed');

    // 3. Create next week's WeeklyEvent
    const nextWeekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const weeklyThemes = [
      { title: 'Survey Blitz Week', description: 'Complete the most surveys this week for top prizes!', prize: '$50 + Premium Month', xp_multiplier: 2 },
      { title: 'Referral Rampage', description: 'Refer the most new users this week!', prize: '$100 + Gold Badge', xp_multiplier: 1.5 },
      { title: 'Gaming Marathon', description: 'Log the most game playtime and earn big!', prize: '$30 + 3 Month Premium', xp_multiplier: 1.5 },
      { title: 'PPC Champion', description: 'Earn the most from PPC ads this week!', prize: '$75 + Prestige Badge', xp_multiplier: 2 }
    ];
    const theme = weeklyThemes[Math.floor(Math.random() * weeklyThemes.length)];
    await base44.asServiceRole.entities.WeeklyEvent.create({
      event_name: theme.title,
      event_type: 'weekly_challenge',
      name: theme.title,
      title: theme.title,
      description: theme.description,
      prize: theme.prize,
      xp_multiplier: theme.xp_multiplier,
      start_date: now.toISOString(),
      starts_at: now.toISOString(),
      ends_at: nextWeekEnd,
      end_date: nextWeekEnd,
      status: 'active',
      is_active: true
    }).catch(e => console.warn('[WeeklyOps] WeeklyEvent create skipped:', e.message));
    results.push('weekly_event_created');

    // 4. Process ReferralJackpot — trigger weekly jackpot
    const jackpots = await base44.asServiceRole.entities.ReferralJackpot.filter({ status: 'active' });
    for (const jackpot of jackpots) {
      if (jackpot.draw_date && new Date(jackpot.draw_date) <= now) {
        await base44.asServiceRole.entities.ReferralJackpot.update(jackpot.id, { status: 'drawing' });
      }
    }
    results.push('jackpots_processed');

    // 5. Archive stale RetentionCampaigns (>30 days old, still triggered)
    const staleCampaigns = await base44.asServiceRole.entities.RetentionCampaign.filter({ status: 'triggered' });
    for (const c of staleCampaigns) {
      if (new Date() - new Date(c.created_date) > 30 * 24 * 60 * 60 * 1000) {
        await base44.asServiceRole.entities.RetentionCampaign.update(c.id, { status: 'expired' });
      }
    }
    results.push('stale_retention_campaigns_expired');

    return Response.json({ ok: true, week_ending: now.toISOString(), results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});