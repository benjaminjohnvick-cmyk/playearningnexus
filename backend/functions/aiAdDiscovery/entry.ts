import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Gather user context in parallel
    const [userActivity, surveyResponses, gameEngagements, transactions] = await Promise.all([
      base44.asServiceRole.entities.UserActivity.filter({ user_id: user.id }).catch(() => []),
      base44.asServiceRole.entities.PPCSurveyResponse.filter({ user_id: user.id }, '-created_date', 50).catch(() => []),
      base44.asServiceRole.entities.GameEngagement.filter({ user_id: user.id }).catch(() => []),
      base44.asServiceRole.entities.Transaction.filter({ user_id: user.id }, '-created_date', 30).catch(() => []),
    ]);

    // Gather available ads/surveys in parallel
    const [ppcSurveys, marketplaceListings, adListings] = await Promise.all([
      base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' }).catch(() => []),
      base44.asServiceRole.entities.SurveyMarketplaceListing.list().catch(() => []),
      base44.asServiceRole.entities.AdListing.filter({ status: 'active' }).catch(() => []),
    ]);

    // Build user engagement profile
    const completedCategories = surveyResponses.map(r => r.category || r.topic || 'General');
    const categoryEarnings = {};
    surveyResponses.forEach(r => {
      const cat = r.category || r.topic || 'General';
      categoryEarnings[cat] = (categoryEarnings[cat] || 0) + parseFloat(r.earnings || r.reward || 0);
    });

    const topEarningCategories = Object.entries(categoryEarnings)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([cat, earn]) => ({ category: cat, total_earned: earn }));

    const gameGenres = gameEngagements.map(g => g.genre).filter(Boolean);
    const topGenres = [...new Set(gameGenres)].slice(0, 3);

    const recentActivityTypes = userActivity.slice(-10).map(a => a.activity_type).filter(Boolean);

    const userProfile = {
      total_earnings: user.total_earnings || 0,
      top_earning_categories: topEarningCategories,
      preferred_game_genres: topGenres,
      recent_activities: recentActivityTypes,
      surveys_completed: surveyResponses.length,
      avg_earnings_per_survey: surveyResponses.length
        ? (surveyResponses.reduce((s, r) => s + parseFloat(r.earnings || r.reward || 0), 0) / surveyResponses.length).toFixed(2)
        : 0,
    };

    // Compile all available ads
    const allAds = [
      ...ppcSurveys.map(s => ({
        id: s.id,
        title: s.title || s.survey_title || 'Survey',
        category: s.category || 'General',
        reward: parseFloat(s.payout || s.reward || 2),
        type: 'survey',
        difficulty: s.estimated_time <= 5 ? 'Easy' : s.estimated_time <= 15 ? 'Medium' : 'Long',
        keywords: s.keywords || [],
      })),
      ...marketplaceListings.slice(0, 20).map(m => ({
        id: m.id,
        title: m.title || m.survey_title || 'Marketplace Survey',
        category: m.category || 'General',
        reward: parseFloat(m.listing_value || m.payout || 1.5),
        type: 'marketplace',
        difficulty: 'Medium',
        keywords: [],
      })),
      ...adListings.slice(0, 20).map(a => ({
        id: a.id,
        title: a.ad_title || a.title || 'Sponsored Ad',
        category: a.category || 'General',
        reward: parseFloat(a.cpc || a.reward || 0.5),
        type: 'ad',
        difficulty: 'Easy',
        keywords: a.target_keywords || [],
      })),
    ];

    // Use AI to generate personalized ad recommendations + boosted section
    const aiResult = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an AI ad discovery engine for a gaming/survey rewards platform called GamerGain.

USER PROFILE:
- Total Lifetime Earnings: $${userProfile.total_earnings}
- Surveys Completed: ${userProfile.surveys_completed}
- Avg Earnings Per Survey: $${userProfile.avg_earnings_per_survey}
- Top Earning Categories: ${JSON.stringify(userProfile.top_earning_categories)}
- Preferred Game Genres: ${userProfile.preferred_game_genres.join(', ') || 'Unknown'}
- Recent Activity: ${userProfile.recent_activities.join(', ') || 'New user'}

AVAILABLE ADS/SURVEYS (${allAds.length} total):
${allAds.slice(0, 40).map(a => `[${a.id}] ${a.title} | Category: ${a.category} | Reward: $${a.reward} | Type: ${a.type} | Difficulty: ${a.difficulty}`).join('\n')}

Based on this user's engagement patterns, survey history, and game preferences, generate:

1. "recommended" (8-10 ads): Best overall matches for this user based on their profile
2. "boosted" (4-5 ads): ONLY ads matching their TOP EARNING SURVEY CATEGORIES — these have highest earning potential for this specific user
3. "trending" (4-5 ads): High-reward, popular ads any active user should see
4. "engagement_insight": 1-2 sentence insight about the user's earning patterns
5. "boost_insight": 1-2 sentence explanation of WHY the boosted ads match their highest-earning topics

For each ad, include: ad_id (from the list), title, category, estimated_reward (number), match_score (0-100), reasoning (short), boost_multiplier (1.0-2.5 for boosted only)

Return as JSON matching this exact schema.`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommended: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ad_id: { type: 'string' },
                title: { type: 'string' },
                category: { type: 'string' },
                estimated_reward: { type: 'number' },
                match_score: { type: 'number' },
                reasoning: { type: 'string' },
              }
            }
          },
          boosted: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ad_id: { type: 'string' },
                title: { type: 'string' },
                category: { type: 'string' },
                estimated_reward: { type: 'number' },
                match_score: { type: 'number' },
                reasoning: { type: 'string' },
                boost_multiplier: { type: 'number' },
              }
            }
          },
          trending: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                ad_id: { type: 'string' },
                title: { type: 'string' },
                category: { type: 'string' },
                estimated_reward: { type: 'number' },
                match_score: { type: 'number' },
                reasoning: { type: 'string' },
              }
            }
          },
          engagement_insight: { type: 'string' },
          boost_insight: { type: 'string' },
        }
      }
    });

    // Enrich AI results with actual ad data
    const enrich = (aiAd) => {
      const real = allAds.find(a => a.id === aiAd.ad_id);
      return {
        ...aiAd,
        type: real?.type || 'survey',
        difficulty: real?.difficulty || 'Medium',
        actual_reward: real?.reward || aiAd.estimated_reward,
      };
    };

    // Track this discovery session
    try {
      await base44.asServiceRole.entities.UserActivity.create({
        user_id: user.id,
        activity_type: 'ai_ad_discovery',
        metadata: {
          recommended_count: aiResult.recommended?.length || 0,
          boosted_count: aiResult.boosted?.length || 0,
          top_category: topEarningCategories[0]?.category || 'none',
        }
      });
    } catch (_) {}

    return Response.json({
      success: true,
      userProfile,
      recommended: (aiResult.recommended || []).map(enrich),
      boosted: (aiResult.boosted || []).map(enrich),
      trending: (aiResult.trending || []).map(enrich),
      engagement_insight: aiResult.engagement_insight || '',
      boost_insight: aiResult.boost_insight || '',
      top_earning_categories: topEarningCategories,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});