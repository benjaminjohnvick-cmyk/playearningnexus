import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { target_language, target_language_label, title, description, questions } = await req.json();

  const prompt = `You are a professional survey translator and cultural localization expert.

Translate the following survey from English to ${target_language_label} (language code: ${target_language}).

CRITICAL RULES:
- Preserve the exact meaning and intent of each question and answer option
- Adapt for cultural context — do not just do word-for-word translation
- Keep answer options mutually exclusive and covering the full range of responses
- Maintain a professional, neutral survey tone
- Ensure questions remain clear and unambiguous in the target language

Survey to translate:

Title: ${title}
Description: ${description || ''}

Questions:
${questions.map((q, i) => `
Q${i + 1}: ${q.question}
A: ${q.option_a}
B: ${q.option_b}
C: ${q.option_c}
D: ${q.option_d}
`).join('\n')}

Return the fully translated survey with the same structure.`;

  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt,
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

  return Response.json({ success: true, translated: result });
});