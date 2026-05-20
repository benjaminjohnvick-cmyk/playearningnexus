import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch recent content/games
    const games = await base44.entities.Game.filter({}, '-created_date', 150);

    let highViral = 0;
    const viralDetections = [];

    for (const game of games) {
      try {
        const daysSinceLaunch = Math.max(1, Math.floor(
          (new Date() - new Date(game.created_date)) / (1000 * 60 * 60 * 24)
        ));

        // Check early viral indicators
        const viralAnalysis = await base44.integrations.Core.InvokeLLM({
          prompt: `Assess viral potential for this content based on early engagement signals.

Game: ${game.title}
Category: ${game.category}
Days Since Launch: ${daysSinceLaunch}
Current Installs: ${game.total_installs}
Average Rating: ${game.average_rating || 'unrated'}
Review Count: ${game.review_count || 0}
Daily Active Users: ${game.active_users || 0}

Return JSON with:
1. viral_score: 0-100 (likelihood to go viral)
2. viral_stage: "dormant", "emerging", "accelerating", "viral"
3. growth_trajectory: "exponential", "linear", "stalled"
4. recommend_boost: boolean (worth promotional investment)
5. marketing_angle: suggested marketing message
6. confidence: 0-100`,
          response_json_schema: {
            type: 'object',
            properties: {
              viral_score: { type: 'number' },
              viral_stage: { type: 'string' },
              growth_trajectory: { type: 'string' },
              recommend_boost: { type: 'boolean' },
              marketing_angle: { type: 'string' },
              confidence: { type: 'number' }
            }
          }
        });

        // Flag for promotion if emerging viral
        if (viralAnalysis.viral_score >= 70 && 
            viralAnalysis.recommend_boost &&
            viralAnalysis.confidence >= 75) {
          highViral++;
        }

        viralDetections.push({
          game_id: game.id,
          game_title: game.title,
          viral_score: viralAnalysis.viral_score,
          stage: viralAnalysis.viral_stage,
          trajectory: viralAnalysis.growth_trajectory,
          marketing_angle: viralAnalysis.marketing_angle,
          confidence: viralAnalysis.confidence,
          flag_for_promotion: viralAnalysis.viral_score >= 70 && viralAnalysis.recommend_boost,
          awaiting_review: viralAnalysis.confidence < 75 && viralAnalysis.viral_score >= 60
        });
      } catch (error) {
        console.error(`Viral detection failed for game ${game.id}:`, error);
      }
    }

    return Response.json({
      content_analyzed: games.length,
      high_viral_potential: highViral,
      emerging_viral: viralDetections.filter(v => v.stage === 'emerging').length,
      accelerating: viralDetections.filter(v => v.stage === 'accelerating').length,
      top_candidates: viralDetections.filter(v => v.viral_score >= 70).slice(0, 20)
    });
  } catch (error) {
    console.error('Viral detection error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});