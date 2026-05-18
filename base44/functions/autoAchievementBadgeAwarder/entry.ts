import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    if (event?.type !== 'create') return Response.json({ ok: true });
    const achievement = data;
    if (!achievement?.user_id) return Response.json({ ok: true });

    const xpRewards = {
      first_survey: 50, survey_veteran: 150, survey_master: 500,
      first_referral: 100, referral_pro: 300, tournament_win: 200,
      streak_7: 100, streak_30: 500, first_purchase: 75
    };

    const xp = xpRewards[achievement.achievement_key] || 25;

    // Create badge record
    await base44.asServiceRole.entities.UserBadge.create({
      user_id: achievement.user_id,
      badge_key: achievement.achievement_key,
      badge_title: achievement.title,
      earned_at: new Date().toISOString(),
      xp_value: xp
    });

    // Send notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: achievement.user_id,
      type: 'achievement_unlocked',
      title: `🏆 Achievement Unlocked: ${achievement.title}`,
      message: `You earned +${xp} XP and a new badge! Keep it up!`,
      is_read: false
    });

    // Log to activity feed
    await base44.asServiceRole.entities.ActivityFeedItem.create({
      user_id: achievement.user_id,
      activity_type: 'achievement',
      title: `🏆 Unlocked: ${achievement.title}`,
      description: `+${xp} XP earned`,
      icon: '🏆',
      is_public: true
    });

    // Update UserLevel XP
    await base44.asServiceRole.entities.UserActivity.create({
      user_id: achievement.user_id,
      activity_type: 'achievement_unlocked',
      points_earned: xp,
      metadata: { achievement_key: achievement.achievement_key }
    });

    return Response.json({ ok: true, xp_awarded: xp });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});