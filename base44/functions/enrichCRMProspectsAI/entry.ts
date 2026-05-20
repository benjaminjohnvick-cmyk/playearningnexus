import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch new prospects awaiting enrichment
    const prospects = await base44.entities.CRMProspect.filter({
      enrichment_status: 'pending'
    }, '-created_date', 50);

    let enrichedCount = 0;
    const results = [];

    for (const prospect of prospects) {
      try {
        // Use Core.InvokeLLM with internet access to research company
        const enrichmentData = await base44.integrations.Core.InvokeLLM({
          prompt: `Research the company "${prospect.company_name}" (website: ${prospect.website || 'unknown'}) and provide real-time business intelligence.

Return JSON with:
1. employee_count: estimated number
2. funding_status: (e.g., "Bootstrapped", "Seed", "Series A", "Series B", "IPO", "Acquired")
3. recent_news: array of 3-5 recent headlines/developments
4. growth_signals: brief assessment of growth indicators`,
          add_context_from_internet: true,
          response_json_schema: {
            type: 'object',
            properties: {
              employee_count: { type: 'number' },
              funding_status: { type: 'string' },
              recent_news: { type: 'array', items: { type: 'string' } },
              growth_signals: { type: 'string' }
            }
          }
        });

        // Compute AI prioritization score based on enriched data
        const priorityAnalysis = await base44.integrations.Core.InvokeLLM({
          prompt: `Based on this company profile, compute a sales prioritization score (0-100) for B2B outreach.

Company: ${prospect.company_name}
Industry: ${prospect.industry}
Size: ${prospect.company_size}
Fit Score: ${prospect.ai_fit_score}
Funding: ${enrichmentData.funding_status}
Employees: ${enrichmentData.employee_count}
Growth Signals: ${enrichmentData.growth_signals}

Score 90-100: Hot prospect (immediate outreach)
Score 70-89: Strong fit (prioritize this month)
Score 50-69: Moderate fit (standard pipeline)
Score <50: Lower priority (nurture list)

Return JSON with score (0-100) and brief reasoning.`,
          response_json_schema: {
            type: 'object',
            properties: {
              prioritization_score: { type: 'number' },
              reasoning: { type: 'string' }
            },
            required: ['prioritization_score', 'reasoning']
          }
        });

        // Update prospect with enriched data
        await base44.entities.CRMProspect.update(prospect.id, {
          employee_count: enrichmentData.employee_count,
          funding_status: enrichmentData.funding_status,
          recent_news: enrichmentData.recent_news || [],
          ai_prioritization_score: Math.min(100, Math.max(0, priorityAnalysis.prioritization_score)),
          enrichment_status: 'completed'
        });

        results.push({
          prospect_id: prospect.id,
          company: prospect.company_name,
          priority_score: priorityAnalysis.prioritization_score,
          status: 'enriched',
          awaiting_review: true
        });

        enrichedCount++;
      } catch (error) {
        console.error(`Enrichment failed for ${prospect.company_name}:`, error);
        await base44.entities.CRMProspect.update(prospect.id, {
          enrichment_status: 'failed'
        });
        results.push({
          prospect_id: prospect.id,
          company: prospect.company_name,
          status: 'failed',
          error: error.message
        });
      }
    }

    return Response.json({
      enriched_count: enrichedCount,
      total_processed: prospects.length,
      results: results,
      requires_review: true
    });
  } catch (error) {
    console.error('Enrichment orchestrator error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});