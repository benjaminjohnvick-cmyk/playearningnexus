import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Daily: refresh personalized UserRecommendation records based on activity
Deno.serve(async (req) => {
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

      // Upsert UserRecommendation
      const existing = await base44.asServiceRole.entities.UserRecommendation.filter({ user_id: user.id });
      const recData = {
        user_id: user.id,
        recommendations: rec.recommendations || [],
        generated_at: new Date().toISOString()
      };
      if (existing.length > 0) {
        await base44.asServiceRole.entities.UserRecommendation.update(existing[0].id, recData);
      } else {
        await base44.asServiceRole.entities.UserRecommendation.create(recData);
      }
      updated++;
    }

    return Response.json({ ok: true, updated });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});