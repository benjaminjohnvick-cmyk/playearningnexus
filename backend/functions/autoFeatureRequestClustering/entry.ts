import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch feature requests
    const requests = await base44.entities.UserSuggestion.filter({
      type: 'feature_request'
    }, '-votes', 500);

    if (requests.length < 10) {
      return Response.json({
        requests_analyzed: requests.length,
        message: 'Need minimum 10 feature requests to cluster'
      });
    }

    // Prepare request summaries
    const requestList = requests.slice(0, 200).map(r => r.suggestion).join('\n- ');

    // Use AI to cluster and prioritize
    const clustering = await base44.integrations.Core.InvokeLLM({
      prompt: `Cluster these feature requests into themes and prioritize implementation.

Feature Requests:
- ${requestList}

Return JSON with:
1. clusters: array of theme names
2. cluster_requests: object mapping theme names to arrays of request IDs/indices
3. cluster_priority: object with priority 0-10 per theme
4. implementation_effort: object with effort estimate per theme (1-5)
5. estimated_revenue_impact: object with revenue impact per theme
6. top_5_priority_themes: array of top 5 themes to build next`,
      response_json_schema: {
        type: 'object',
        properties: {
          clusters: { type: 'array', items: { type: 'string' } },
          cluster_priority: { type: 'object', additionalProperties: { type: 'number' } },
          implementation_effort: { type: 'object', additionalProperties: { type: 'number' } },
          estimated_revenue_impact: { type: 'object', additionalProperties: { type: 'string' } },
          top_5_priority_themes: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    return Response.json({
      requests_analyzed: Math.min(requests.length, 200),
      clusters_identified: clustering.clusters.length,
      cluster_list: clustering.clusters,
      priorities: clustering.cluster_priority,
      top_priorities: clustering.top_5_priority_themes,
      effort_estimates: clustering.implementation_effort,
      revenue_impact: clustering.estimated_revenue_impact
    });
  } catch (error) {
    console.error('Feature clustering error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});