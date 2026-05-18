import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { 
      product_name, 
      product_url, 
      product_category,
      target_audience,
      num_questions = 5 
    } = await req.json();

    if (!product_name || !product_url) {
      return Response.json({ 
        error: 'Missing product_name or product_url' 
      }, { status: 400 });
    }

    // AI-generate 5-question survey with product link embedded
    const prompt = `You are an expert survey designer creating a ${num_questions}-question product feedback survey.

Product: ${product_name}
Website: ${product_url}
Category: ${product_category || 'General'}
Target Audience: ${target_audience || 'General consumers'}

Generate exactly ${num_questions} clear, unbiased questions to gather product feedback. Each question should help evaluate product appeal, usability, and likelihood to purchase/recommend.

For each question, provide:
1. A clear question about the product
2. 4 multiple choice options (a, b, c, d)
3. Brief rationale

Format response as JSON:
{
  "survey_title": "...",
  "survey_description": "...",
  "product_name": "${product_name}",
  "product_url": "${product_url}",
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
          product_name: { type: 'string' },
          product_url: { type: 'string' },
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
      survey: result,
      cost_per_question: 0.10,
      total_cost: (result.questions?.length || 5) * 0.10
    });
  } catch (error) {
    console.error('Product survey generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});