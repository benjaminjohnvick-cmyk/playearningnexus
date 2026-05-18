import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Allow scheduled/headless calls; only block non-admin authenticated users
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get current platform data
    const games = await base44.asServiceRole.entities.Game.filter({
      status: { $in: ['approved', 'featured'] }
    }, '-total_installs', 50);

    const surveys = await base44.asServiceRole.entities.PPCSurvey.filter({}, '-created_date', 100);
    const transactions = await base44.asServiceRole.entities.Transaction.filter({
      status: 'completed'
    }, '-created_date', 1000);

    const topCategories = {};
    games.forEach(g => {
      topCategories[g.category] = (topCategories[g.category] || 0) + 1;
    });

    const marketMetrics = {
      active_games: games.length,
      top_category: Object.entries(topCategories).sort((a, b) => b[1] - a[1])[0]?.[0],
      avg_game_price: games.reduce((sum, g) => sum + (g.price || 0), 0) / games.length,
      total_survey_responses: surveys.length,
      transaction_volume_7d: transactions.filter(t => {
        const date = new Date(t.created_date);
        return (new Date() - date) < 7 * 24 * 60 * 60 * 1000;
      }).length
    };

    // AI market analysis with web context
    const marketAnalysis = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze gaming and survey platform market trends:

Platform Data:
- Active Games: ${marketMetrics.active_games}
- Top Category: ${marketMetrics.top_category}
- Avg Game Price: $${marketMetrics.avg_game_price.toFixed(2)}
- Weekly Transactions: ${marketMetrics.transaction_volume_7d}

Provide:
1. Market opportunities: Emerging niches to target
2. Competitive positioning: Where we stand vs market
3. Pricing strategy: Recommended adjustments
4. Content gaps: What users are looking for
5. Growth trends: Categories gaining traction`,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          market_opportunities: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          competitive_advantage: { type: 'string' },
          pricing_recommendation: { type: 'string' },
          content_gaps: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          growth_trends: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          market_sentiment: { type: 'string' },
          action_items: { type: 'array', items: { type: 'string' }, maxItems: 4 }
        }
      }
    });

    const analysisData = marketAnalysis?.data || {};
    return Response.json({
      success: true,
      analysis_date: new Date().toISOString(),
      market_metrics: marketMetrics,
      market_intelligence: analysisData,
      top_opportunities: analysisData.market_opportunities || [],
      recommended_actions: analysisData.action_items || [],
      competitive_outlook: analysisData.market_sentiment || null
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});