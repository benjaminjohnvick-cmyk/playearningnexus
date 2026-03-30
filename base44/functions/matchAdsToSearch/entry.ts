import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchQuery } = await req.json();
    if (!searchQuery) return Response.json({ error: 'Search query required' }, { status: 400 });

    // Get user's search/engagement history
    const userActivity = await base44.asServiceRole.entities.UserActivity.filter({ user_id: user.id }).catch(() => []);
    
    // Get available PPC surveys and ads
    const ppcSurveys = await base44.asServiceRole.entities.PPCSurvey.list().catch(() => []);
    const marketplaceListings = await base44.asServiceRole.entities.SurveyMarketplaceListing.list().catch(() => []);

    // Compile all available ads
    const allAds = [
      ...ppcSurveys.map(s => ({ ...s, type: 'survey', reward: s.payout || 5 })),
      ...marketplaceListings.map(m => ({ ...m, type: 'listing', reward: m.listing_value || 0 })),
    ];

    // Use AI to match search query to relevant ads
    const matchResults = await base44.integrations.Core.InvokeLLM({
      prompt: `You are an AI ad matching engine. A user searched for: "${searchQuery}"

User Profile:
- Recent Activity: ${userActivity.slice(-5).map(a => a.activity_type).join(', ') || 'New user'}
- Total Earnings: $${user.total_earnings || 0}

AVAILABLE ADS/SURVEYS:
${allAds.slice(0, 30).map(ad => `- ${ad.title || ad.survey_title} (${ad.type}, Reward: $${ad.reward}, Keywords: ${ad.keywords?.join(', ') || 'None'})`).join('\n')}

Based on the search query, relevance score, and user profile, recommend 5-8 highly relevant ads that:
1. Match the search intent
2. Are appropriate for this user's activity level
3. Have good reward-to-effort ratio
4. Are likely to convert

Return as JSON with:
{
  "matchedAds": [
    {
      "title": "Ad Title",
      "relevance_score": 85,
      "estimated_reward": 10,
      "estimated_time": 5,
      "reasoning": "Why this matches the search"
    }
  ],
  "search_insight": "Brief insight about what this user is looking for"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          matchedAds: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                relevance_score: { type: 'number' },
                estimated_reward: { type: 'number' },
                estimated_time: { type: 'number' },
                reasoning: { type: 'string' },
              }
            }
          },
          search_insight: { type: 'string' }
        }
      }
    });

    // Match AI results to actual ads
    const finalMatches = matchResults.matchedAds.map(match => {
      const foundAd = allAds.find(ad => 
        (ad.title || ad.survey_title).toLowerCase().includes(match.title.toLowerCase())
      );
      return {
        ...match,
        ad_id: foundAd?.id,
        actual_title: foundAd?.title || foundAd?.survey_title || match.title,
        ad_type: foundAd?.type,
        actual_reward: foundAd?.reward || match.estimated_reward,
      };
    });

    // Track search for future personalization
    try {
      await base44.asServiceRole.entities.UserActivity.create({
        user_id: user.id,
        activity_type: 'ppc_search',
        metadata: { search_query: searchQuery, matched_ads_count: finalMatches.length }
      });
    } catch (e) {
      // Silently fail on activity logging
    }

    return Response.json({
      success: true,
      searchQuery,
      matches: finalMatches,
      insight: matchResults.search_insight,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});