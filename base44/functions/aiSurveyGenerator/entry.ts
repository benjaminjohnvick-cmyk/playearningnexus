import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { prompt, min_questions = 10 } = await req.json();

    if (!prompt || prompt.trim().length === 0) {
      return Response.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Generate survey questions using AI
    const response = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Generate a professional survey with exactly ${min_questions} questions based on this topic: "${prompt}"

Return ONLY a JSON object (no markdown, no extra text) with this structure:
{
  "title": "Survey Title",
  "description": "Brief description",
  "questions": [
    {
      "question": "Question text?",
      "type": "multiple_choice",
      "answers": ["Option 1", "Option 2", "Option 3", "Option 4"]
    },
    {
      "question": "Rating question?",
      "type": "rating",
      "answers": ["1", "2", "3", "4", "5"]
    }
  ]
}

Guidelines:
- Mix question types (multiple choice, rating, short text)
- Make questions professional and unbiased
- Ensure variety in answer options
- Create at least ${min_questions} questions
- Keep questions concise and clear`,
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          questions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                question: { type: 'string' },
                type: { type: 'string' },
                answers: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        }
      }
    });

    // Validate response has minimum questions
    if (!response.questions || response.questions.length < min_questions) {
      return Response.json({
        error: `Failed to generate ${min_questions} questions. Please try a more specific prompt.`,
        generated: response.questions?.length || 0
      }, { status: 400 });
    }

    return Response.json({
      title: response.title || 'Untitled Survey',
      description: response.description || '',
      questions: response.questions.slice(0, 20) // Limit to 20 questions max
    });

  } catch (error) {
    console.error('Error in aiSurveyGenerator:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});