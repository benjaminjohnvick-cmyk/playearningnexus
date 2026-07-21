import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get competitor trends and top templates
    const [trends, templates] = await Promise.all([
      base44.entities.CompetitorTrendAnalysis.filter({}, '-analyzed_at', 5),
      base44.entities.ContentLibraryTemplate.filter({ status: 'active', featured: true }, '-performance_metrics.performance_score', 10)
    ]);

    if (!trends.length || !templates.length) {
      return Response.json({ error: 'No trends or templates available' }, { status: 400 });
    }

    // Generate personalized content suggestions using AI
    const suggestionPrompt = `Based on these trending topics and high-performing content templates, suggest 3 specific content ideas for an affiliate:\n\nTrending Topics:\n${trends.map(t => `- ${t.competitor_name}: ${t.top_trends.map(tr => tr.trend_name).join(', ')}`).join('\n')}\n\nTop Templates:\n${templates.map(t => `- ${t.template_name} (${t.performance_metrics.performance_score}% score)`).join('\n')}\n\nCreate actionable content ideas with specific copy snippets and hashtag recommendations.`;

    const suggestions = await base44.integrations.Core.InvokeLLM({
      prompt: suggestionPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          suggestions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                platform: { type: 'string' },
                copy_snippet: { type: 'string' },
                hashtags: { type: 'array', items: { type: 'string' } },
                why_this_works: { type: 'string' }
              }
            }
          }
        }
      }
    });

    return Response.json({
      success: true,
      suggestions: suggestions.suggestions,
      based_on_trends: trends.map(t => t.competitor_name)
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});