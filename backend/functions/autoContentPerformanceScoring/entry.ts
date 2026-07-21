import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch content/games with engagement data
    const games = await base44.entities.Game.filter({}, '-total_installs', 100);
    
    let contentScored = 0;
    const scores = [];

    for (const game of games) {
      try {
        // Calculate engagement metrics
        const daysSinceLaunch = Math.max(1, Math.floor(
          (new Date() - new Date(game.created_date)) / (1000 * 60 * 60 * 24)
        ));
        const installVelocity = game.total_installs / daysSinceLaunch;
        const retentionRate = game.active_users / (game.total_installs || 1) * 100;

        // Use AI to score and generate optimization recommendations
        const performanceAnalysis = await base44.integrations.Core.InvokeLLM({
          prompt: `Score this game's performance and recommend optimization strategies.

Game: ${game.title}
Category: ${game.category}
Days Active: ${daysSinceLaunch}
Total Installs: ${game.total_installs}
Install Velocity: ${installVelocity.toFixed(2)} per day
Retention Rate: ${retentionRate.toFixed(1)}%
Rating: ${game.average_rating || 'unrated'}

Return JSON with:
1. performance_score: 0-100 (engagement health)
2. performance_tier: "viral", "strong", "moderate", "struggling"
3. optimization_priorities: array of top 3 actions
4. estimated_impact: brief estimate of potential uplift
5. confidence: 0-100`,
          response_json_schema: {
            type: 'object',
            properties: {
              performance_score: { type: 'number' },
              performance_tier: { type: 'string' },
              optimization_priorities: { type: 'array', items: { type: 'string' } },
              estimated_impact: { type: 'string' },
              confidence: { type: 'number' }
            }
          }
        });

        // Auto-apply if high confidence
        if (performanceAnalysis.confidence >= 80) {
          contentScored++;
          // In production: update game with performance_score and tier
        }

        scores.push({
          game_id: game.id,
          game_title: game.title,
          performance_score: performanceAnalysis.performance_score,
          tier: performanceAnalysis.performance_tier,
          priorities: performanceAnalysis.optimization_priorities,
          confidence: performanceAnalysis.confidence,
          applied: performanceAnalysis.confidence >= 80,
          awaiting_review: performanceAnalysis.confidence < 80 && performanceAnalysis.confidence >= 70
        });
      } catch (error) {
        console.error(`Scoring failed for game ${game.id}:`, error);
      }
    }

    return Response.json({
      content_analyzed: games.length,
      content_scored: contentScored,
      pending_review: scores.filter(s => s.awaiting_review).length,
      top_performers: scores.filter(s => s.tier === 'viral').slice(0, 10),
      struggling: scores.filter(s => s.tier === 'struggling').slice(0, 10)
    });
  } catch (error) {
    console.error('Content scoring error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});