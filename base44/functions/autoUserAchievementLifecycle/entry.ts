import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const achievement = data;
    if (!achievement?.id || event?.type !== 'create') return Response.json({ ok: true });
    if (!achievement.user_id) return Response.json({ ok: true });

    // XP reward per achievement type
    const xpMap = {
      first_survey: 50, first_referral: 75, streak_7: 100, streak_30: 300,
      level_10: 200, top_earner: 500, tournament_win: 250, default: 25
    };
    const xp = xpMap[achievement.achievement_key] || xpMap.default;

    // In-app notification
    await base44.asServiceRole.entities.Notification.create({
      user_id: achievement.user_id,
      type: 'achievement_earned',
      title: `🏅 Achievement Unlocked!`,
      message: `You earned the "${achievement.achievement_key?.replace(/_/g, ' ')}" achievement! +${xp} XP`,
      is_read: false
    });

    // Award XP
    await base44.asServiceRole.entities.UserActivity.create({
      user_id: achievement.user_id,
      activity_type: 'achievement_earned',
      points_earned: xp,
      metadata: { achievement_key: achievement.achievement_key }
    });

    // Create ActivityFeedItem
    await base44.asServiceRole.entities.ActivityFeedItem.create({
      user_id: achievement.user_id,
      activity_type: 'achievement',
      title: `🏅 Earned: ${achievement.achievement_key?.replace(/_/g, ' ')}`,
      description: `Unlocked the achievement!`,
      related_entity_id: achievement.id,
      icon: '🏅',
      is_public: true
    });

    return Response.json({ ok: true, xp_awarded: xp });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});