import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const [wishlistItems, completedSurveys, savedSearches, allSurveys] = await Promise.all([
      base44.entities.ProductWishlistItem.filter({ user_id: user.id }, '-created_date', 10).catch(() => []),
      base44.entities.PPCSurveyResponse.filter({ user_id: user.id }, '-created_date', 30).catch(() => []),
      base44.entities.SavedSurveySearch.filter({ user_id: user.id }, '-created_date', 10).catch(() => []),
      base44.entities.PPCSurvey.filter({ status: 'active' }, '-bid_amount', 20).catch(() => []),
    ]);

    const wishlistKeywords = wishlistItems.map(i => i.product_name || '').filter(Boolean);
    const completedIds = new Set(completedSurveys.map(r => r.survey_id));
    const searchTerms = savedSearches.map(s => s.search_query || '').filter(Boolean);
    const interests = user.interests || [];

    const availableSurveys = allSurveys.filter(s => !completedIds.has(s.id));

    if (availableSurveys.length === 0) {
      return Response.json({ recommendations: [], message: 'No new surveys available right now.' });
    }

    const surveyList = availableSurveys.map(s => ({
      id: s.id,
      title: s.survey_title || s.title,
      category: s.category,
      reward: s.reward_amount || s.bid_amount,
      estimated_time: s.estimated_time || 5,
      target_demographics: s.target_demographics || '',
      keywords: s.keywords || [],
    }));

    const context = {
      user_interests: interests,
      wishlist_keywords: wishlistKeywords,
      past_search_terms: searchTerms,
      total_surveys_completed: completedSurveys.length,
      user_age: user.age || null,
      user_location: user.location || null,
    };

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a survey recommendation engine for a reward platform.

User profile:
${JSON.stringify(context, null, 2)}

Available surveys:
${JSON.stringify(surveyList, null, 2)}

Select the TOP 5 best surveys for this user. Consider:
1. Highest reward per minute
2. Match to their interests and wishlist
3. Surveys they are most likely to qualify for based on their profile
4. Variety of topics to avoid fatigue

Return a JSON with a "recommendations" array where each item has:
- survey_id (string)
- match_score (0-100)
- reason (1-sentence personalized explanation)
- estimated_earnings (number)`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                survey_id: { type: 'string' },
                match_score: { type: 'number' },
                reason: { type: 'string' },
                estimated_earnings: { type: 'number' },
              },
            },
          },
        },
      },
    });

    // Enrich recommendations with full survey data
    const enriched = (result?.recommendations || []).map(rec => {
      const survey = availableSurveys.find(s => s.id === rec.survey_id);
      return { ...rec, survey };
    }).filter(r => r.survey);

    return Response.json({ recommendations: enriched });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});