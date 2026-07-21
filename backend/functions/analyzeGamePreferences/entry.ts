import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Fetch user's game engagement data
    const gameEngagements = await base44.asServiceRole.entities.GameEngagement.filter({ user_id: user.id });
    const surveys = await base44.asServiceRole.entities.Survey.filter({ created_by: user.email }).catch(() => []);
    
    // Calculate user profile metrics
    const totalGamesPlayed = gameEngagements.length;
    const avgTimeSpent = gameEngagements.reduce((sum, g) => sum + (g.time_spent_minutes || 0), 0) / (totalGamesPlayed || 1);
    const completionRate = gameEngagements.filter(g => g.status === 'completed').length / (totalGamesPlayed || 1);
    const favoriteGenres = gameEngagements
      .reduce((acc, g) => ({ ...acc, [g.genre]: (acc[g.genre] || 0) + 1 }), {});
    
    // Survey performance metrics
    const totalSurveysCompleted = surveys.length;
    const avgSurveyValue = surveys.reduce((sum, s) => sum + (s.reward || 0), 0) / (surveys.length || 1);

    // Get available games
    const allGames = await base44.asServiceRole.entities.Game.list();
    const gamesNotPlayed = allGames.filter(g => !gameEngagements.find(e => e.game_id === g.id));

    const userProfile = {
      gamesPlayed: totalGamesPlayed,
      avgSessionLength: Math.round(avgTimeSpent),
      completionRate: Math.round(completionRate * 100),
      preferredGenres: Object.entries(favoriteGenres)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([genre]) => genre),
      surveysCompleted: totalSurveysCompleted,
      avgTaskValue: Math.round(avgSurveyValue * 100) / 100,
      playStyle: completionRate > 0.7 ? 'completion-focused' : completionRate > 0.4 ? 'casual' : 'explorer',
    };

    // Use AI to analyze and recommend
    const recommendations = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a mobile game recommendation expert. Analyze this player profile and recommend games they will likely enjoy and complete in-game tasks for.

USER PROFILE:
- Games Played: ${userProfile.gamesPlayed}
- Average Session: ${userProfile.avgSessionLength} minutes
- Completion Rate: ${userProfile.completionRate}%
- Preferred Genres: ${userProfile.preferredGenres.join(', ') || 'Not enough data'}
- Surveys Completed: ${userProfile.surveysCompleted}
- Play Style: ${userProfile.playStyle}
- Task Completion Value: $${userProfile.avgTaskValue}

AVAILABLE GAMES TO RECOMMEND FROM:
${gamesNotPlayed.slice(0, 20).map(g => `- ${g.title} (${g.genre}, ${g.difficulty || 'Medium'} difficulty, Est. rewards: $${g.estimated_reward || 5})`).join('\n')}

Based on this profile, provide 3-5 specific game recommendations that match their:
1. Play style and preferred genres
2. Session length preferences
3. Completion likelihood (focus on achievable in-game tasks)
4. Monetary reward expectations

Return as JSON with this structure:
{
  "recommendations": [
    {
      "game_title": "Game Name",
      "reasoning": "Why this game matches their profile",
      "completion_confidence": 85,
      "estimated_reward": 15,
      "estimated_playtime": 45
    }
  ],
  "overall_insight": "Brief insight about this player's gaming style"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                game_title: { type: 'string' },
                reasoning: { type: 'string' },
                completion_confidence: { type: 'number' },
                estimated_reward: { type: 'number' },
                estimated_playtime: { type: 'number' }
              }
            }
          },
          overall_insight: { type: 'string' }
        }
      },
    });

    // Match recommendations to actual game objects
    const recommendedGames = recommendations.recommendations.map(rec => {
      const matchedGame = gamesNotPlayed.find(g => g.title.toLowerCase().includes(rec.game_title.toLowerCase()));
      return {
        ...rec,
        game_id: matchedGame?.id,
        actual_title: matchedGame?.title || rec.game_title,
        actual_genre: matchedGame?.genre,
      };
    });

    return Response.json({
      success: true,
      userProfile,
      recommendations: recommendedGames,
      insight: recommendations.overall_insight,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});