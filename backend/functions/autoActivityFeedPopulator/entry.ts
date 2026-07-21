import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Entity trigger: creates ActivityFeedItems for key UserActivity events
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json();
  const { event, data } = body;

  try {
    const activity = data;
    if (!activity?.id || event?.type !== 'create') return Response.json({ ok: true });
    if (!activity.user_id) return Response.json({ ok: true });

    // Map activity types to feed items
    const feedMap = {
      survey_completed: { title: '📋 Completed a survey', icon: '📋' },
      game_rated: { title: '⭐ Rated a game', icon: '⭐' },
      level_up: { title: '🎉 Leveled up!', icon: '🎉' },
      in_app_purchase: { title: '🛒 Made a purchase', icon: '🛒' },
      streak_milestone: { title: '🔥 Hit a streak milestone!', icon: '🔥' },
      tournament_match_won: { title: '⚔️ Won a tournament match', icon: '⚔️' },
      guild_join: { title: '⚔️ Joined a guild', icon: '⚔️' },
      friend_connected: { title: '👥 Made a new friend', icon: '👥' },
      guide_published: { title: '📖 Published a game guide', icon: '📖' },
      affiliate_sale: { title: '💰 Made an affiliate sale', icon: '💰' },
      gift_sent: { title: '🎁 Sent a gift', icon: '🎁' }
    };

    const feedDef = feedMap[activity.activity_type];
    if (!feedDef) return Response.json({ ok: true }); // Not every activity needs a feed item

    await base44.asServiceRole.entities.ActivityFeedItem.create({
      user_id: activity.user_id,
      activity_type: activity.activity_type === 'level_up' ? 'level_up' : 
                     activity.activity_type === 'in_app_purchase' ? 'purchase' :
                     activity.activity_type === 'survey_completed' ? 'survey_complete' : 'achievement',
      title: feedDef.title,
      description: activity.metadata ? JSON.stringify(activity.metadata).substring(0, 100) : '',
      related_entity_id: activity.id,
      icon: feedDef.icon,
      is_public: true
    });

    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});