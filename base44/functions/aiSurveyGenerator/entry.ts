import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { prompt, surveyType, productName } = await req.json();

    if (!prompt) return Response.json({ error: 'Prompt is required' }, { status: 400 });

    const typeContext = surveyType === 'product_listing'
      ? `This is a product listing survey for: "${productName || 'a product'}". Generate questions that help gauge consumer interest, buying intent, product perception, price sensitivity, and feature preferences.`
      : `This is a data collection survey about: "${prompt}". Generate questions that collect meaningful market research data.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are a professional survey designer. ${typeContext}

User's topic/description: "${prompt}"

Generate exactly 10 multiple-choice survey questions. Each question must have exactly 4 answer options (A, B, C, D).

Rules:
- Questions must be clear, concise, and professional
- Answer options must be mutually exclusive and comprehensive
- Mix question types: opinion, behavior, demographics, preferences
- Keep each question under 100 characters
- Keep each answer option under 60 characters

Return ONLY valid JSON in this exact format:
{
  "title": "A professional survey title based on the topic",
  "questions": [
    {
      "question": "Question text here?",
      "option_a": "First option",
      "option_b": "Second option",
      "option_c": "Third option",
      "option_d": "Fourth option"
    }
  ]
}`,
      response_json_schema: {
        type: "object",
        properties: {
          title: { type: "string" },
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                option_a: { type: "string" },
                option_b: { type: "string" },
                option_c: { type: "string" },
                option_d: { type: "string" }
              }
            }
          }
        }
      }
    });

    return Response.json({ success: true, title: result.title, questions: result.questions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});