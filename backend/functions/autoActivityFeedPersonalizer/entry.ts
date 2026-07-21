import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Daily: refresh personalized UserRecommendation records based on activity
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const users = await base44.asServiceRole.entities.User.list('-created_date', 50);
    let updated = 0;

    for (const user of users) {
      const recentActivity = await base44.asServiceRole.entities.UserActivity.filter({ user_id: user.id });
      const feedItems = await base44.asServiceRole.entities.ActivityFeedItem.list('-created_date', 20);
      const publicFeed = feedItems.filter(f => f.is_public && f.user_id !== user.id).slice(0, 10);

      const activityTypes = [...new Set(recentActivity.map(a => a.activity_type))];

      const rec = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate 3 personalized content recommendations for a gaming platform user:
User activity types: ${activityTypes.join(', ') || 'none yet'}
Recent feed items available: ${publicFeed.map(f => f.title).join('; ')}
Platform features: surveys, game store, tournaments, referrals, wishlist

Return 3 recommendations as array of {title, description, category, cta_url}`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  description: { type: 'string' },
                  category: { type: 'string' },
                  cta_url: { type: 'string' }
                }
              }
            }
          }
        }
      });

      // Upsert UserRecommendation records (one per recommendation)
      const recs = rec.recommendations || [];
      for (let i = 0; i < recs.length; i++) {
        const recommendation = recs[i];
        const recData = {
          user_id: user.id,
          recommendation_type: recommendation.category || 'game',
          entity_id: recommendation.cta_url || `rec_${user.id}_${i}`,
          relevance_score: 85 - (i * 5), // Higher score for first recommendation
          reason: recommendation.description
        };
        await base44.asServiceRole.entities.UserRecommendation.create(recData);
      }
      updated++;
    }

    return Response.json({ ok: true, updated });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});