import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch market trends and competitor content
    const [trends, templates] = await Promise.all([
      base44.entities.CompetitorTrendAnalysis.filter({}, '-analyzed_at', 3),
      base44.entities.ContentLibraryTemplate.filter({ featured: true }, '-performance_metrics.performance_score', 5)
    ]);

    // Generate brand-aligned creative campaigns
    const creativeBriefPrompt = `Create 3 brand campaign concepts that stand out:
Current trends: ${trends.map(t => t.top_trends.map(tr => tr.trend_name).join(', ')).join(' | ')}
Top performers: ${templates.map(t => t.template_name).join(', ')}

Provide: 1) Campaign theme, 2) Visual direction, 3) Copy tone, 4) Platform strategy, 5) Expected impact.`;

    const campaigns = await base44.integrations.Core.InvokeLLM({
      prompt: creativeBriefPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          campaigns: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                theme: { type: 'string' },
                visual_direction: { type: 'string' },
                copy_tone: { type: 'string' },
                platforms: { type: 'array', items: { type: 'string' } },
                expected_impact: { type: 'string' }
              }
            }
          }
        }
      }
    });

    return Response.json({
      success: true,
      creative_campaigns: campaigns.campaigns
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});