import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  const user = await base44.auth.me();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { prompt } = await req.json();
  if (!prompt || !prompt.trim()) {
    return Response.json({ error: 'Prompt is required' }, { status: 400 });
  }

  const llmResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `You are a professional survey researcher. A user wants to create a survey with the following goal:

"${prompt}"

Generate a complete, high-quality market research survey based on this goal.

Rules:
- Create a concise, descriptive survey title (max 80 characters)
- Create a short description of the survey purpose (max 180 characters)
- Generate exactly 10 multiple-choice questions
- Each question must have exactly 4 answer options (option_a, option_b, option_c, option_d)
- Questions should be clear, unbiased, and directly relevant to the user's stated goal
- Answer options should be distinct, comprehensive, and cover the likely range of responses
- Mix question types: some demographic, some attitudinal, some behavioral
- Do NOT include "None of the above" or "All of the above" as options
- Make the survey feel professional and polished`,
    response_json_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
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

  const survey = await base44.asServiceRole.entities.PPCSurvey.create({
    creator_user_id: user.id,
    survey_type: "data_collection",
    title: llmResult.title,
    product_description: llmResult.description,
    questions: llmResult.questions,
    ai_generated: true,
    ai_prompt: prompt,
    status: "draft",
    tier: 1,
    sample_size: 100,
    cost_per_response: 4,
    min_spend: 400,
    responses_count: 0,
    total_spent: 0,
    budget_remaining: 0
  });

  return Response.json({
    success: true,
    survey_id: survey.id,
    title: llmResult.title,
    description: llmResult.description,
    questions: llmResult.questions
  });
});