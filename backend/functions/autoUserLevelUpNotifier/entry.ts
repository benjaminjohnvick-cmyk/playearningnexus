import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data, old_data } = body;

  try {
    const levelRecord = data;
    if (!levelRecord?.id || event?.type !== 'update') return Response.json({ ok: true });

    const newLevel = levelRecord.level || 0;
    const oldLevel = old_data?.level || 0;

    if (newLevel <= oldLevel) return Response.json({ ok: true });

    const userId = levelRecord.user_id;
    if (!userId) return Response.json({ ok: true });

    const user = (await base44.asServiceRole.entities.User.filter({ id: userId }))[0];

    // Level-up notification with bonus rewards
    const levelBonuses = {
      5: { bonus: 0.50, badge: 'Rising Star' },
      10: { bonus: 1.00, badge: 'Veteran Player' },
      25: { bonus: 2.50, badge: 'Elite Gamer' },
      50: { bonus: 5.00, badge: 'Legend' },
      100: { bonus: 10.00, badge: 'GamerGain Legend' }
    };

    const milestone = levelBonuses[newLevel];

    await base44.asServiceRole.entities.Notification.create({
      user_id: userId,
      type: 'level_up',
      title: `🎉 Level Up! You're now Level ${newLevel}!`,
      message: milestone
        ? `🏆 MILESTONE! Level ${newLevel} reached! You earned the "${milestone.badge}" badge and $${milestone.bonus} bonus!`
        : `You've reached Level ${newLevel}! Keep earning to unlock more rewards and badges.`,
      is_read: false
    });

    // Award milestone badge and bonus
    if (milestone) {
      await base44.asServiceRole.entities.UserBadge.create({
        user_id: userId,
        badge_name: milestone.badge,
        badge_type: 'level_milestone',
        earned_at: new Date().toISOString(),
        level_achieved: newLevel
      });

      // Credit bonus to user
      const currentEarnings = user?.total_earnings || 0;
      await base44.asServiceRole.entities.User.update(userId, {
        total_earnings: currentEarnings + milestone.bonus
      });

      if (user?.email) {
        await base44.integrations.Core.SendEmail({
          to: user.email,
          subject: `🎉 Level ${newLevel} Milestone Unlocked on GamerGain!`,
          body: `Congratulations ${user.full_name}! You've reached Level ${newLevel} on GamerGain!\n\nYou've earned:\n• The "${milestone.badge}" badge\n• $${milestone.bonus} bonus added to your account\n\nKeep playing and earning to reach the next milestone!`
        });
      }
    }

    return Response.json({ ok: true, leveled_up: true, new_level: newLevel, milestone: !!milestone });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});