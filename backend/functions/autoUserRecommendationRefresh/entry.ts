import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Daily: refresh personalized recommendations for active users and notify them
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const results = [];
    // Get users who were active in last 7 days
    const recentActivity = await base44.asServiceRole.entities.UserActivity.list('-created_date', 100);
    const activeUserIds = [...new Set(recentActivity.map(a => a.user_id).filter(Boolean))].slice(0, 30);

    const games = await base44.asServiceRole.entities.Game.filter({ status: 'approved' });
    const surveys = await base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' });

    for (const userId of activeUserIds) {
      // Delete stale recommendations (>2 days old, not clicked)
      const stale = await base44.asServiceRole.entities.UserRecommendation.filter({ user_id: userId, clicked: false });
      for (const r of stale) {
        if (new Date() - new Date(r.created_date) > 2 * 24 * 60 * 60 * 1000) {
          await base44.asServiceRole.entities.UserRecommendation.delete(r.id);
        }
      }

      // Create fresh game recommendations (top 3)
      const topGames = games.slice(0, 3);
      for (const game of topGames) {
        await base44.asServiceRole.entities.UserRecommendation.create({
          user_id: userId,
          recommendation_type: 'game',
          entity_id: game.id,
          relevance_score: 70 + Math.floor(Math.random() * 30),
          reason: `Trending game in ${game.category || 'gaming'}`,
          shown: false,
          clicked: false,
          converted: false
        });
      }

      // Create fresh survey recommendations (top 2)
      const topSurveys = surveys.slice(0, 2);
      for (const survey of topSurveys) {
        await base44.asServiceRole.entities.UserRecommendation.create({
          user_id: userId,
          recommendation_type: 'survey',
          entity_id: survey.id,
          relevance_score: 75 + Math.floor(Math.random() * 25),
          reason: `High-paying survey matching your profile`,
          shown: false,
          clicked: false,
          converted: false
        });
      }

      // Notify user of new recommendations
      await base44.asServiceRole.entities.Notification.create({
        user_id: userId,
        type: 'new_recommendations',
        title: `🎯 New Personalized Picks for You!`,
        message: `We found ${topGames.length} games and ${topSurveys.length} surveys tailored to your interests. Check them out!`,
        is_read: false
      });

      results.push(userId);
    }

    return Response.json({ ok: true, users_refreshed: results.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});