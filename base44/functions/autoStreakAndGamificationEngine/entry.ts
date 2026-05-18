import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: daily streaks, XP awards, level-ups, badges, leaderboard updates, challenges, seasonal ranks
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};
    const today = new Date().toISOString().split('T')[0];

    // 1. Update daily streaks for all active users
    const activeUsers = await base44.asServiceRole.entities.User.list('-updated_date', 200);
    let streakUpdates = 0;
    for (const u of activeUsers.slice(0, 100)) {
      const earnings = await base44.asServiceRole.entities.DailyEarnings.filter({ user_id: u.id, date: today });
      const hasEarnedToday = earnings.length > 0 && earnings[0].total_surveys_completed > 0;

      const streakRecords = await base44.asServiceRole.entities.Streak.filter({ user_id: u.id });
      const streak = streakRecords[0];

      if (hasEarnedToday && streak) {
        const lastActive = new Date(streak.last_active_date);
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        const shouldExtend = streak.last_active_date === yesterday || streak.last_active_date === today;
        if (streak.last_active_date !== today) {
          await base44.asServiceRole.entities.Streak.update(streak.id, {
            current_streak: shouldExtend ? (streak.current_streak || 0) + 1 : 1,
            longest_streak: Math.max(streak.longest_streak || 0, shouldExtend ? (streak.current_streak || 0) + 1 : 1),
            last_active_date: today
          });
          streakUpdates++;
        }
      } else if (!hasEarnedToday && streak) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
        if (streak.last_active_date < yesterday && streak.current_streak > 0) {
          await base44.asServiceRole.entities.Streak.update(streak.id, { current_streak: 0 });
          streakUpdates++;
        }
      }
    }
    results.streaks_updated = streakUpdates;

    // 2. Batch award achievements
    await base44.asServiceRole.functions.invoke('batchAwardAchievements', {});
    await base44.asServiceRole.functions.invoke('checkAndAwardBadges', {});
    results.achievements_awarded = true;

    // 3. Award XP for all qualifying actions
    await base44.asServiceRole.functions.invoke('awardUserXP', { batch: true });
    results.xp_awarded = true;

    // 4. Calculate global prestige scores
    await base44.asServiceRole.functions.invoke('calculateGlobalPrestige', {});
    results.prestige_calculated = true;

    // 5. Update leaderboard entries
    const topEarners = await base44.asServiceRole.entities.User.list('-total_earnings', 100);
    for (let i = 0; i < Math.min(topEarners.length, 50); i++) {
      const u = topEarners[i];
      const existing = await base44.asServiceRole.entities.LeaderboardEntry.filter({ user_id: u.id, leaderboard_type: 'earnings' });
      if (existing.length > 0) {
        await base44.asServiceRole.entities.LeaderboardEntry.update(existing[0].id, {
          score: u.total_earnings || 0,
          rank: i + 1,
          updated_at: new Date().toISOString()
        });
      } else {
        await base44.asServiceRole.entities.LeaderboardEntry.create({
          user_id: u.id,
          leaderboard_type: 'earnings',
          score: u.total_earnings || 0,
          rank: i + 1
        });
      }
    }
    results.leaderboard_updated = true;

    // 6. Process daily challenges
    const activeChallenges = await base44.asServiceRole.entities.DailyChallenge.filter({ date: today, status: 'active' });
    if (activeChallenges.length === 0) {
      await base44.asServiceRole.entities.DailyChallenge.create({
        date: today,
        title: 'Daily Survey Sprint',
        description: 'Complete 3 surveys today',
        requirement_type: 'surveys',
        requirement_value: 3,
        reward_points: 100,
        reward_amount: 0.5,
        status: 'active'
      });
      results.daily_challenge_created = true;
    }

    // 7. Weekly event management
    const activeEvents = await base44.asServiceRole.entities.WeeklyEvent.filter({ status: 'active' });
    results.active_weekly_events = activeEvents.length;

    // 8. Season rank updates
    const currentSeason = await base44.asServiceRole.entities.Season.filter({ status: 'active' });
    if (currentSeason.length > 0) {
      results.active_season = currentSeason[0].name;
    }

    // 9. Rewards engine
    await base44.asServiceRole.functions.invoke('aiRewardsEngine', {});
    results.rewards_processed = true;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});