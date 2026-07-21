import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Daily: update streaks, send reminders for at-risk streaks
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const results = { updated: 0, broken: 0, reminded: 0 };

    const streaks = await base44.asServiceRole.entities.Streak.list('-updated_date', 200);

    for (const streak of streaks) {
      const lastDate = streak.last_activity_date;

      if (lastDate === today) continue; // Already updated today

      if (lastDate === yesterday) {
        // Streak still alive — send reminder to keep it going
        await base44.asServiceRole.entities.Notification.create({
          user_id: streak.user_id,
          type: 'streak_reminder',
          title: `🔥 Keep Your ${streak.current_streak || 1}-Day Streak Alive!`,
          message: `Complete a survey or daily challenge today to maintain your streak and earn bonus XP!`,
          is_read: false
        });
        results.reminded++;
      } else if (lastDate && lastDate < yesterday) {
        // Streak broken
        const oldStreak = streak.current_streak || 0;
        await base44.asServiceRole.entities.Streak.update(streak.id, {
          current_streak: 0,
          longest_streak: Math.max(streak.longest_streak || 0, oldStreak)
        });
        if (oldStreak >= 3) {
          await base44.asServiceRole.entities.Notification.create({
            user_id: streak.user_id,
            type: 'streak_broken',
            title: `😢 Your ${oldStreak}-Day Streak Ended`,
            message: `Your streak was broken! Start a new one today — streaks earn bonus XP and unlock exclusive rewards.`,
            is_read: false
          });
        }
        results.broken++;
      }
    }

    // Award milestone streak achievements
    const milestoneStreaks = await base44.asServiceRole.entities.Streak.filter({});
    for (const streak of milestoneStreaks) {
      const curr = streak.current_streak || 0;
      for (const milestone of [7, 14, 30, 60, 100]) {
        if (curr === milestone) {
          const existing = await base44.asServiceRole.entities.UserAchievement.filter({
            user_id: streak.user_id, achievement_key: `streak_${milestone}`
          });
          if (existing.length === 0) {
            await base44.asServiceRole.entities.UserAchievement.create({
              user_id: streak.user_id,
              achievement_key: `streak_${milestone}`,
              title: `🔥 ${milestone}-Day Streak Master`,
              unlocked_at: new Date().toISOString()
            });
          }
        }
      }
    }

    results.updated = streaks.length;
    return Response.json({ ok: true, ...results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});