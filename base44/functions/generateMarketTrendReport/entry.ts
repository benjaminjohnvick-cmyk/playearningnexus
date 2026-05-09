import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Aggregate game engagement and install data by category
    const games = await base44.asServiceRole.entities.Game.list('-created_date', 200);
    const surveys = await base44.asServiceRole.entities.PPCSurvey.list('-created_date', 500);
    const transactions = await base44.asServiceRole.entities.Transaction.filter({ transaction_type: 'install_fee' }, '-created_date', 1000);

    // Aggregate by category
    const categoryStats = {};
    for (const game of games) {
      const cat = game.category || 'uncategorized';
      if (!categoryStats[cat]) {
        categoryStats[cat] = { category: cat, games: 0, totalInstalls: 0, totalRevenue: 0, avgRating: 0, ratingCount: 0, platforms: new Set() };
      }
      categoryStats[cat].games++;
      categoryStats[cat].totalInstalls += (game.total_installs || 0);
      categoryStats[cat].totalRevenue += (game.total_revenue || 0);
      if (game.average_rating) { categoryStats[cat].avgRating += game.average_rating; categoryStats[cat].ratingCount++; }
      (game.platform || []).forEach(p => categoryStats[cat].platforms.add(p));
    }

    // Survey engagement by category-linked data
    const surveyStats = { total: surveys.length, avgResponses: 0, topCategories: [] };
    if (surveys.length > 0) {
      surveyStats.avgResponses = surveys.reduce((s, sv) => s + (sv.response_count || sv.min_sample_size || 0), 0) / surveys.length;
    }

    // Install transactions in last 30 days
    const now = Date.now();
    const recentInstalls = transactions.filter(t => now - new Date(t.created_date) < 30 * 86400000);

    // Format for AI
    const categoryArray = Object.values(categoryStats).map(s => ({
      ...s,
      avgRating: s.ratingCount > 0 ? (s.avgRating / s.ratingCount).toFixed(2) : 'N/A',
      platforms: [...s.platforms].join(', '),
      roiScore: s.totalInstalls > 0 ? (s.totalRevenue / s.totalInstalls).toFixed(2) : '0',
    }));

    const prompt = `You are a market analyst for GamerGain, a gaming + survey platform. 
Analyze the following aggregated data and generate a comprehensive weekly Market Trend Report for developers.

PLATFORM DATA SUMMARY:
- Total games analyzed: ${games.length}
- Total surveys on platform: ${surveys.length}
- Avg survey responses: ${surveyStats.avgResponses.toFixed(0)}
- Install transactions last 30 days: ${recentInstalls.length}

GAME CATEGORY STATS (sorted by installs):
${JSON.stringify(categoryArray.sort((a, b) => b.totalInstalls - a.totalInstalls).slice(0, 10), null, 2)}

Generate a detailed market trend report with:
1. Top 3 performing categories by ROI
2. Emerging categories showing growth signals
3. Specific ad campaign recommendations for each top category
4. Survey demand insights (which categories get most engagement)
5. Platform-specific recommendations (iOS vs Android vs Web)
6. Actionable next steps for developers

Be specific with percentages, numbers, and concrete recommendations.

Return as JSON with this structure:
{
  "report_title": "string",
  "report_period": "string",
  "executive_summary": "string",
  "top_categories": [
    {
      "rank": number,
      "category": "string",
      "roi_score": number,
      "install_volume": number,
      "avg_revenue_per_install": number,
      "trend": "rising|stable|declining",
      "trend_pct": number,
      "ad_recommendation": "string",
      "target_audience": "string",
      "best_platforms": ["string"],
      "avg_cpi": number,
      "opportunity_score": number
    }
  ],
  "emerging_categories": [
    { "category": "string", "signal": "string", "growth_pct": number, "recommendation": "string" }
  ],
  "survey_insights": {
    "most_engaged_category": "string",
    "avg_completion_rate": number,
    "high_value_segments": ["string"],
    "key_finding": "string"
  },
  "platform_breakdown": [
    { "platform": "string", "market_share": number, "best_categories": ["string"], "cpi_range": "string" }
  ],
  "actionable_steps": ["string"],
  "market_health_score": number,
  "next_report_date": "string"
}`;

    const report = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          report_title: { type: 'string' },
          report_period: { type: 'string' },
          executive_summary: { type: 'string' },
          top_categories: { type: 'array', items: { type: 'object' } },
          emerging_categories: { type: 'array', items: { type: 'object' } },
          survey_insights: { type: 'object' },
          platform_breakdown: { type: 'array', items: { type: 'object' } },
          actionable_steps: { type: 'array', items: { type: 'string' } },
          market_health_score: { type: 'number' },
          next_report_date: { type: 'string' }
        }
      }
    });

    return Response.json({ success: true, report, generated_at: new Date().toISOString(), data_points: { games: games.length, surveys: surveys.length, transactions: transactions.length } });
  } catch (error) {
    console.error('generateMarketTrendReport error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});