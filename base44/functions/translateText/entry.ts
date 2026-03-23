import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const LANGUAGE_NAMES = {
  es: 'Spanish', fr: 'French', de: 'German', zh: 'Simplified Chinese',
  ja: 'Japanese', pt: 'Portuguese', ar: 'Arabic', ko: 'Korean', hi: 'Hindi'
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { texts, targetLanguage } = await req.json();

    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return Response.json({ translations: [] });
    }
    if (!targetLanguage || targetLanguage === 'en') {
      return Response.json({ translations: texts });
    }

    const langName = LANGUAGE_NAMES[targetLanguage] || targetLanguage;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Translate the following UI text strings to ${langName}.
Return ONLY a JSON object with key "translations" containing an array of translated strings in the exact same order.
Rules:
- Keep formatting intact (spaces, punctuation, line breaks)
- Do NOT translate proper nouns: GamerGain, BitLabs, PayPal, Stripe, PPC
- Keep currency symbols and numbers as-is
- Keep emoji as-is
- Keep short UI labels concise

Strings to translate:
${JSON.stringify(texts)}`,
      response_json_schema: {
        type: 'object',
        properties: {
          translations: { type: 'array', items: { type: 'string' } }
        },
        required: ['translations']
      }
    });

    return Response.json({ translations: result.translations || texts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});