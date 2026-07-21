import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Auto-creates and optimizes ad campaigns for developers who don't have one
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const developers = await base44.asServiceRole.entities.BusinessClient.filter({ account_status: 'active' });
    let created = 0;

    for (const dev of developers) {
      // Get their games
      const games = await base44.asServiceRole.entities.Game.filter({ developer_id: dev.id, status: 'approved' });
      if (games.length === 0) continue;

      for (const game of games) {
        // Check if an ad listing already exists
        const existing = await base44.asServiceRole.entities.AdListing.filter({ game_id: game.id, status: 'active' });
        if (existing.length > 0) continue;

        const { InvokeLLM } = base44.asServiceRole.integrations.Core;

        const adCopy = await InvokeLLM({
          prompt: `Create a high-converting ad campaign for this mobile game on GamerGain:
Game: ${game.title}
Category: ${game.category}
Description: ${game.description || 'A fun mobile game'}
Platform: ${(game.platform || ['mobile']).join(', ')}
Price: ${game.price > 0 ? `$${game.price}` : 'Free'}

Generate:
1. A compelling headline (max 60 chars)
2. Ad body copy (max 150 chars)
3. 3 relevant hashtags
4. Target audience description

Respond with JSON: { "headline": "string", "body": "string", "hashtags": ["string"], "target_audience": "string" }`,
          response_json_schema: {
            type: 'object',
            properties: {
              headline: { type: 'string' },
              body: { type: 'string' },
              hashtags: { type: 'array', items: { type: 'string' } },
              target_audience: { type: 'string' },
            }
          }
        });

        await base44.asServiceRole.entities.AdListing.create({
          game_id: game.id,
          developer_id: dev.id,
          headline: adCopy.headline,
          body: adCopy.body,
          hashtags: adCopy.hashtags,
          target_audience: adCopy.target_audience,
          status: 'active',
          auto_generated: true,
          daily_budget: 10,
          platforms: ['facebook', 'twitter', 'instagram', 'tiktok'],
        });
        created++;
      }
    }

    return Response.json({ success: true, created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});