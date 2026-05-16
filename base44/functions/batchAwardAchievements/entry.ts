import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Batch Achievement Awarder
 * Scheduled daily: checks all active users for newly earned achievements and badges.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const [allUsers, allAchievements, allUserAchievements, allResponses, allReferrals, allEarnings] = await Promise.all([
      base44.asServiceRole.entities.User.list('-updated_date', 300),
      base44.asServiceRole.entities.Achievement.filter({ is_active: true }),
      base44.asServiceRole.entities.UserAchievement.list('-created_date', 5000),
      base44.asServiceRole.entities.PPCSurveyResponse.filter({ completed: true }),
      base44.asServiceRole.entities.Referral.list('-created_date', 2000),
      base44.asServiceRole.entities.DailyEarnings.list('-date', 10000),
    ]);

    let totalAwarded = 0;

    for (const user of allUsers) {
      const daysSinceActive = (Date.now() - new Date(user.updated_date)) / (1000 * 60 * 60 * 24);
      if (daysSinceActive > 30) continue;

      const earnedKeys = new Set(
        allUserAchievements.filter(a => a.user_id === user.id).map(a => a.achievement_key)
      );

      const userResponses = allResponses.filter(r => r.user_id === user.id).length;
      const userReferrals = allReferrals.filter(r => r.referrer_user_id === user.id && r.status === 'active').length;
      const userEarnings = allEarnings.filter(e => e.user_id === user.id);
      const totalEarned = userEarnings.reduce((s, e) => s + (e.total_earned || 0), 0);

      // Streak calc
      const sortedEarnings = userEarnings.sort((a, b) => new Date(b.date) - new Date(a.date));
      let streak = 0;
      let prevDate = null;
      for (const e of sortedEarnings) {
        const d = new Date(e.date);
        if (!prevDate) { streak = 1; prevDate = d; continue; }
        const diff = (prevDate - d) / 86400000;
        if (diff === 1) { streak++; prevDate = d; } else break;
      }

      for (const achievement of allAchievements) {
        if (earnedKeys.has(achievement.achievement_key)) continue;

        let shouldAward = false;
        const key = achievement.achievement_key;
        const val = achievement.requirement_value;

        if (key.startsWith('surveys_') && userResponses >= val) shouldAward = true;
        else if (key.startsWith('referral_') && userReferrals >= val) shouldAward = true;
        else if (key.startsWith('earnings_') && totalEarned >= val) shouldAward = true;
        else if (key.startsWith('streak_') && streak >= val) shouldAward = true;

        if (shouldAward) {
          await base44.asServiceRole.entities.UserAchievement.create({
            user_id: user.id,
            achievement_key: key,
            earned_at: new Date().toISOString(),
          });

          await base44.asServiceRole.entities.Notification.create({
            user_id: user.id,
            type: 'achievement_unlocked',
            title: `🏆 Achievement Unlocked: ${achievement.title}`,
            message: achievement.description || `You earned the ${achievement.title} badge!`,
            status: 'unread',
            delivery_method: ['in_app'],
            action_url: '/AchievementsPage',
            icon: 'trophy',
          });

          totalAwarded++;
        }
      }
    }

    return Response.json({ success: true, achievements_awarded: totalAwarded });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});