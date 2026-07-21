import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch market competitors/businesses
    const businesses = await base44.entities.BusinessClient.filter({}, '-created_date', 50);

    let intelligenceGathered = 0;
    const intelligence = [];

    for (const business of businesses) {
      try {
        // Use internet search to gather competitive intelligence
        const competitiveAnalysis = await base44.integrations.Core.InvokeLLM({
          prompt: `Analyze the competitive landscape for this business and identify market threats/opportunities.

Business: ${business.company_name}
Industry: ${business.industry || 'unknown'}
Website: ${business.website || 'unknown'}

Return JSON with:
1. top_competitors: array of 3-5 main competitors
2. market_trends: array of current industry trends
3. pricing_positioning: brief competitive pricing assessment
4. market_opportunities: array of 3 opportunities
5. threats: array of 2-3 competitive threats
6. recommendation: strategic action to take
7. confidence: 0-100`,
          add_context_from_internet: true,
          response_json_schema: {
            type: 'object',
            properties: {
              top_competitors: { type: 'array', items: { type: 'string' } },
              market_trends: { type: 'array', items: { type: 'string' } },
              pricing_positioning: { type: 'string' },
              market_opportunities: { type: 'array', items: { type: 'string' } },
              threats: { type: 'array', items: { type: 'string' } },
              recommendation: { type: 'string' },
              confidence: { type: 'number' }
            }
          }
        });

        if (competitiveAnalysis.confidence >= 75) {
          intelligenceGathered++;
        }

        intelligence.push({
          business_id: business.id,
          company: business.company_name,
          competitors: competitiveAnalysis.top_competitors,
          trends: competitiveAnalysis.market_trends,
          opportunities: competitiveAnalysis.market_opportunities,
          threats: competitiveAnalysis.threats,
          recommendation: competitiveAnalysis.recommendation,
          confidence: competitiveAnalysis.confidence,
          awaiting_review: competitiveAnalysis.confidence < 80
        });
      } catch (error) {
        console.error(`Analysis failed for business ${business.id}:`, error);
      }
    }

    return Response.json({
      businesses_analyzed: businesses.length,
      intelligence_gathered: intelligenceGathered,
      awaiting_review: intelligence.filter(i => i.awaiting_review).length,
      intelligence: intelligence.slice(0, 20)
    });
  } catch (error) {
    console.error('Competitive intelligence error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});