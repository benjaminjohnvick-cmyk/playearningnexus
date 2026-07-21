import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * AI-classifies open-text survey responses into recurring themes.
 * Payload: { survey_id, survey_title, responses }
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { survey_id, survey_title, responses } = await req.json();

    // Gather all open-text answers
    const openTexts = [];
    (responses || []).forEach((r, ri) => {
      (r.answers || []).forEach(a => {
        if (a.open_text?.trim().length > 5) {
          openTexts.push(a.open_text.trim());
        }
      });
    });

    if (openTexts.length === 0) {
      return Response.json({ success: true, themes: [], message: 'No open-text responses to classify' });
    }

    const sampleTexts = openTexts.slice(0, 80).join('\n---\n');

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a qualitative research analyst. Analyze the following open-text survey responses from "${survey_title || 'a survey'}" and identify the top recurring themes.

Survey Responses:
${sampleTexts}

Instructions:
- Identify 4-8 distinct themes
- For each theme, provide: a short title (2-5 words), a description (1 sentence), an estimated percentage of responses that fall into this theme, example quotes (1-2), and a sentiment (positive/negative/neutral/mixed)
- Order themes by prevalence (most common first)

Return JSON only.`,
      response_json_schema: {
        type: 'object',
        properties: {
          themes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                percentage: { type: 'number' },
                sentiment: { type: 'string' },
                example_quotes: { type: 'array', items: { type: 'string' } },
              }
            }
          },
          overall_summary: { type: 'string' }
        }
      }
    });

    return Response.json({ success: true, themes: result.themes || [], overall_summary: result.overall_summary || '' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});