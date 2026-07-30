import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { cacheGet, cacheSet } from "../../sdk/cache.ts";

const LANGUAGE_NAMES = {
  es: 'Spanish', fr: 'French', de: 'German', zh: 'Simplified Chinese',
  ja: 'Japanese', pt: 'Portuguese', ar: 'Arabic', ko: 'Korean', hi: 'Hindi'
};

// Tiny stable hash for cache keys (keeps keys bounded regardless of string length).
function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
const TR_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days — UI strings rarely change; translate each ONCE.

// translateText — DO-ONCE translation: each unique (string, language) pair is translated a single time
// and cached; repeat views cost nothing. Only the strings NOT already cached are sent to the (cheap-tier)
// model, in one batched call. UI strings are highly repetitive, so hit-rate approaches 100%.
export default __handler(async (req) => {
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

    // 1) Cache-first: fill what we already know; collect the misses to translate.
    const out = new Array(texts.length);
    const missIdx = [];
    const missTexts = [];
    for (let i = 0; i < texts.length; i++) {
      const key = `tr:${targetLanguage}:${hash(String(texts[i]))}`;
      const hit = await cacheGet(key);
      if (typeof hit === 'string') out[i] = hit;
      else { missIdx.push(i); missTexts.push(texts[i]); }
    }

    // 2) Only the misses hit the model — one batched, cheap-tier call.
    if (missTexts.length > 0) {
      const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: 'gpt_5_mini',   // translation is simple, structured work — cheap tier
        prompt: `Translate the following UI text strings to ${langName}.
Return ONLY a JSON object with key "translations" containing an array of translated strings in the exact same order.
Rules:
- Keep formatting intact (spaces, punctuation, line breaks)
- Do NOT translate proper nouns: GamerGain, BitLabs, PayPal, Stripe, PPC
- Keep currency symbols and numbers as-is
- Keep emoji as-is
- Keep short UI labels concise

Strings to translate:
${JSON.stringify(missTexts)}`,
        response_json_schema: {
          type: 'object',
          properties: {
            translations: { type: 'array', items: { type: 'string' } }
          },
          required: ['translations']
        }
      });
      const translated = Array.isArray(result?.translations) ? result.translations : missTexts;
      for (let j = 0; j < missIdx.length; j++) {
        const val = translated[j] != null ? String(translated[j]) : String(missTexts[j]);
        out[missIdx[j]] = val;
        // Cache the newly-translated string for next time (do-once).
        await cacheSet(`tr:${targetLanguage}:${hash(String(missTexts[j]))}`, val, TR_TTL_SECONDS);
      }
    }

    return Response.json({ translations: out });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
