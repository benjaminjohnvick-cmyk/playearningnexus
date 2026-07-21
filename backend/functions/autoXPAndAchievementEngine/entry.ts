import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (event?.type !== 'create') return Response.json({ ok: true });
    const activity = data;
    if (!activity?.user_id) return Response.json({ ok: true });

    const xpMap = {
      survey_completed: 50,
      game_installed: 30,
      game_played: 20,
      referral_converted: 100,
      account_created: 10,
      daily_login: 5,
      review_submitted: 25,
      suggestion_implemented: 250,
      tournament_win: 200,
      streak_maintained: 15
    };

    const xp = activity.points_earned || xpMap[activity.activity_type] || 10;

    // Update UserLevel
    const levels = await base44.asServiceRole.entities.UserLevel.filter({ user_id: activity.user_id });
    if (levels.length > 0) {
      const lvl = levels[0];
      const newXP = (lvl.current_xp || 0) + xp;
      const xpForNextLevel = (lvl.level || 1) * 500;
      const leveled = newXP >= xpForNextLevel;
      await base44.asServiceRole.entities.UserLevel.update(lvl.id, {
        current_xp: leveled ? newXP - xpForNextLevel : newXP,
        level: leveled ? (lvl.level || 1) + 1 : (lvl.level || 1),
        total_xp_earned: (lvl.total_xp_earned || 0) + xp
      });
      if (leveled) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: activity.user_id,
          type: 'level_up',
          title: `⬆️ Level Up! You're now Level ${(lvl.level || 1) + 1}!`,
          message: `Keep earning XP to unlock new rewards and climb the leaderboard!`,
          is_read: false
        });
      }
    } else {
      await base44.asServiceRole.entities.UserLevel.create({
        user_id: activity.user_id,
        level: 1,
        current_xp: xp,
        total_xp_earned: xp
      });
    }

    // Check achievement milestones
    const achievementChecks = {
      survey_completed: [{ count: 1, key: 'first_survey', title: 'First Survey Complete!' }, { count: 10, key: 'survey_veteran', title: 'Survey Veteran (10)' }, { count: 100, key: 'survey_master', title: 'Survey Master (100)' }],
      referral_converted: [{ count: 1, key: 'first_referral', title: 'First Referral!' }, { count: 5, key: 'referral_pro', title: 'Referral Pro (5)' }]
    };

    const checks = achievementChecks[activity.activity_type];
    if (checks) {
      const allActivities = await base44.asServiceRole.entities.UserActivity.filter({ user_id: activity.user_id, activity_type: activity.activity_type });
      for (const check of checks) {
        if (allActivities.length >= check.count) {
          const existing = await base44.asServiceRole.entities.UserAchievement.filter({ user_id: activity.user_id, achievement_key: check.key });
          if (existing.length === 0) {
            await base44.asServiceRole.entities.UserAchievement.create({
              user_id: activity.user_id,
              achievement_key: check.key,
              title: check.title,
              unlocked_at: new Date().toISOString()
            });
          }
        }
      }
    }

    return Response.json({ ok: true, xp_awarded: xp });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});