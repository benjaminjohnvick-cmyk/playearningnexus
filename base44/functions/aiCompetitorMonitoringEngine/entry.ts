import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Define key competitors to monitor
    const competitors = [
      { name: 'Competitor A', domain: 'competitor-a.com', market_segment: 'gaming_rewards' },
      { name: 'Competitor B', domain: 'competitor-b.com', market_segment: 'survey_platform' },
      { name: 'Competitor C', domain: 'competitor-c.com', market_segment: 'affiliate_network' }
    ];

    // Fetch recent social sentiment data (simulated web data via AI analysis)
    const competitorAnalysisPrompt = `
Analyze the current market landscape for these competitors and our platform based on public knowledge:

Competitors:
${competitors.map(c => `- ${c.name} (${c.domain}) - Segment: ${c.market_segment}`).join('\n')}

Our Platform Focus: Gaming rewards, surveys, affiliate marketing, user earnings

Provide market intelligence on:
1. Estimated pricing strategies (free tier, premium tiers, commission rates)
2. Key feature offerings and gaps
3. Social sentiment indicators (positive/negative trends)
4. Market share positioning
5. Recent product innovation areas

Format as JSON with fields:
- competitor_insights: array of {competitor_name, estimated_pricing, key_features, sentiment, market_position}
- market_trends: array of {trend_name, impact_level, relevance_to_us}
- opportunities: array of {opportunity, urgency, estimated_revenue_impact}
- threats: array of {threat_name, severity, mitigation_strategy}
`;

    const marketAnalysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: competitorAnalysisPrompt,
      add_context_from_internet: true,
      response_json_schema: {
        type: 'object',
        properties: {
          competitor_insights: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                competitor_name: { type: 'string' },
                estimated_pricing: { type: 'string' },
                key_features: { type: 'array', items: { type: 'string' } },
                sentiment: { type: 'string' },
                market_position: { type: 'string' }
              }
            }
          },
          market_trends: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                trend_name: { type: 'string' },
                impact_level: { type: 'string' },
                relevance_to_us: { type: 'string' }
              }
            }
          },
          opportunities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                opportunity: { type: 'string' },
                urgency: { type: 'string' },
                estimated_revenue_impact: { type: 'string' }
              }
            }
          },
          threats: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                threat_name: { type: 'string' },
                severity: { type: 'string' },
                mitigation_strategy: { type: 'string' }
              }
            }
          }
        }
      }
    });

    // Get internal platform metrics for comparison
    const orders = await base44.asServiceRole.entities.Order.filter({}, '', 100);
    const surveys = await base44.asServiceRole.entities.PPCSurvey.filter({}, '', 100);
    const affiliates = await base44.asServiceRole.entities.Referral.filter({}, '', 100);

    const internalMetrics = {
      total_orders: orders.length,
      total_order_value: orders.reduce((sum, o) => sum + (o.total_amount || 0), 0),
      avg_order_value: orders.length > 0 ? orders.reduce((sum, o) => sum + (o.total_amount || 0), 0) / orders.length : 0,
      active_surveys: surveys.filter(s => s.status === 'active').length,
      affiliate_count: affiliates.length,
      total_referral_value: affiliates.reduce((sum, r) => sum + (r.conversion_value || 0), 0)
    };

    // AI generate strategic recommendations based on market analysis
    const strategyPrompt = `
Based on this market analysis and our platform metrics, generate 5 strategic recommendations:

Market Analysis:
${JSON.stringify(marketAnalysis, null, 2)}

Our Metrics:
${JSON.stringify(internalMetrics, null, 2)}

Provide specific recommendations for:
1. Pricing adjustments (if any)
2. Feature prioritization
3. Marketing focus areas
4. Risk mitigation actions
5. Revenue growth opportunities

Format as JSON with "recommendations" array containing: category, action, priority, expected_impact, implementation_effort.
`;

    const strategy = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: strategyPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                category: { type: 'string' },
                action: { type: 'string' },
                priority: { type: 'string' },
                expected_impact: { type: 'string' },
                implementation_effort: { type: 'string' }
              }
            }
          }
        }
      }
    });

    // Store competitive intelligence report
    const report = await base44.asServiceRole.entities.MarketResearchReport.create({
      title: `Weekly Competitive Intelligence Report - ${new Date().toLocaleDateString()}`,
      category: 'competitive_analysis',
      summary: `Analyzed ${competitors.length} competitors with ${marketAnalysis.market_trends?.length || 0} market trends identified`,
      data_period_start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      data_period_end: new Date().toISOString().split('T')[0],
      sample_size: competitors.length,
      report_data: {
        competitor_insights: marketAnalysis.competitor_insights,
        market_trends: marketAnalysis.market_trends,
        internal_metrics: internalMetrics
      },
      ai_insights: (strategy.recommendations || []).map(r => r.action),
      status: 'available'
    });

    return Response.json({
      status: 'success',
      report_id: report.id,
      competitors_analyzed: competitors.length,
      market_analysis: {
        competitor_count: marketAnalysis.competitor_insights?.length || 0,
        trends_identified: marketAnalysis.market_trends?.length || 0,
        opportunities_found: marketAnalysis.opportunities?.length || 0,
        threats_identified: marketAnalysis.threats?.length || 0
      },
      strategic_recommendations: strategy.recommendations?.slice(0, 5),
      internal_metrics: internalMetrics,
      report_generated_at: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});