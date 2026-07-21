import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { survey_goal, target_audience, num_questions = 5 } = await req.json();

    if (!survey_goal || !target_audience) {
      return Response.json({ 
        error: 'Missing survey_goal or target_audience' 
      }, { status: 400 });
    }

    // Call AI to generate survey
    const prompt = `You are an expert survey designer. Generate a ${num_questions}-question survey based on:

Goal: ${survey_goal}
Target Audience: ${target_audience}

For each question, provide:
1. A clear, unbiased question
2. 4 multiple choice options (a, b, c, d)
3. A brief rationale

Format response as JSON with structure:
{
  "survey_title": "...",
  "survey_description": "...",
  "questions": [
    {
      "question": "...",
      "option_a": "...",
      "option_b": "...",
      "option_c": "...",
      "option_d": "...",
      "rationale": "..."
    }
  ],
  "completion_tips": ["tip1", "tip2", "tip3"]
}`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          survey_title: { type: 'string' },
          survey_description: { type: 'string' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                option_a: { type: 'string' },
                option_b: { type: 'string' },
                option_c: { type: 'string' },
                option_d: { type: 'string' },
                rationale: { type: 'string' }
              }
            }
          },
          completion_tips: {
            type: 'array',
            items: { type: 'string' }
          }
        }
      }
    });

    return Response.json({
      success: true,
      survey: result
    });
  } catch (error) {
    console.error('AI survey generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});