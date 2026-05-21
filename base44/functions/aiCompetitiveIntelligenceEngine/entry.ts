import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Search for competitive intelligence across multiple dimensions
    const competitorSearches = [
      'gaming survey app features 2026 updates',
      'mobile game monetization trends 2026',
      'survey platform pricing strategies',
      'in-game reward systems competitors',
      'web3 gaming survey integration',
      'AI-powered game discovery platforms'
    ];

    const allIntelligence = [];

    for (const searchQuery of competitorSearches) {
      const results = await base44.integrations.Core.InvokeLLM({
        prompt: `Search and analyze: "${searchQuery}"
        
Provide:
1. Top 3-5 key findings from the market
2. Competitor moves (features, pricing, partnerships)
3. Market gaps we can exploit
4. Emerging trends
5. Threat level to our platform`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            key_findings: { type: 'array', items: { type: 'string' }, maxItems: 5 },
            competitor_moves: { type: 'array', items: { type: 'string' }, maxItems: 4 },
            market_gaps: { type: 'array', items: { type: 'string' }, maxItems: 3 },
            emerging_trends: { type: 'array', items: { type: 'string' }, maxItems: 3 },
            threat_level: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] }
          }
        }
      });

      allIntelligence.push({
        search_query: searchQuery,
        key_findings: results?.key_findings || [],
        competitor_moves: results?.competitor_moves || [],
        market_gaps: results?.market_gaps || [],
        emerging_trends: results?.emerging_trends || [],
        threat_level: results?.threat_level || 'medium',
        collected_at: new Date().toISOString()
      });
    }

    // Consolidate insights and identify strategic opportunities
    const strategicAnalysis = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze consolidated competitive intelligence:

${allIntelligence.map(i => `\n${i.search_query}:
- Threats: ${i.threat_level}
- Gaps: ${((i && i.market_gaps) || []).join(', ')}
- Trends: ${((i && i.emerging_trends) || []).join(', ')}`).join('')}

Provide strategic recommendations:
1. Top 3 features we must implement to stay competitive
2. Pricing adjustments needed
3. New market opportunities
4. Strategic partnerships to consider
5. Which competitor moves do we need to counter immediately?
6. Platform roadmap priorities (next 90 days)`,
      response_json_schema: {
        type: 'object',
        properties: {
          critical_features: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          pricing_strategy: { type: 'string' },
          new_opportunities: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          partnership_targets: { type: 'array', items: { type: 'string' }, maxItems: 2 },
          immediate_counters: { type: 'array', items: { type: 'string' }, maxItems: 3 },
          roadmap_priorities: { type: 'array', items: { type: 'string' }, maxItems: 5 },
          competitive_advantage: { type: 'string' }
        }
      }
    });

    // Store intelligence report
    const report = await base44.asServiceRole.entities.MarketTrendReport?.create?.({
      report_date: new Date().toISOString(),
      report_type: 'competitive_intelligence',
      threat_assessment: JSON.stringify(allIntelligence.map(i => ({ query: i.search_query, threat: i.threat_level }))),
      strategic_recommendations: JSON.stringify(strategicAnalysis),
      data_source: 'ai_web_search_aggregation'
    }).catch(() => null);

    return Response.json({
      success: true,
      report_timestamp: new Date().toISOString(),
      intelligence_sources: allIntelligence.length,
      overall_threat_level: allIntelligence.filter(i => i.threat_level === 'critical').length > 0 ? 'critical' : 
                           allIntelligence.filter(i => i.threat_level === 'high').length > 2 ? 'high' : 'medium',
      competitive_intelligence: allIntelligence,
      strategic_analysis: strategicAnalysis,
      action_items: (strategicAnalysis?.critical_features || []).map(f => ({
        action: 'implement_feature',
        feature: f,
        priority: 'critical'
      }))
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});