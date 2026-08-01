// chat-i18n.ts — translate buddy/group chat so people in different countries can talk, each reading in their
// own language. Reuses the do-once cache + cheap-tier model pattern from translateText.
//
// Note on scam detection across languages: the scam guard's concrete signals (app names like Instagram/
// WhatsApp, payment services like Venmo/Cash App, links, phone/emails, crypto addresses) are language-
// agnostic and still fire on non-English text. Phrase-level detection ("send me money" in another language)
// is a documented follow-up.

import { cacheGet, cacheSet } from "./cache.ts";

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", zh: "Simplified Chinese",
  ja: "Japanese", pt: "Portuguese", ar: "Arabic", ko: "Korean", hi: "Hindi", ru: "Russian",
  it: "Italian", nl: "Dutch", tr: "Turkish", pl: "Polish", vi: "Vietnamese", id: "Indonesian",
};

export function languageName(code: string): string {
  return LANGUAGE_NAMES[String(code || "").toLowerCase()] || String(code || "");
}

function hash(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}
const TTL = 60 * 60 * 24 * 14; // 14 days — chat lines can repeat (cheers etc.); translate each once.

/** Translate an array of chat strings to targetLang. Cache-first; only misses hit the cheap-tier model. */
export async function translateChat(base44: any, texts: string[], targetLang: string): Promise<string[]> {
  const lang = String(targetLang || "en").toLowerCase();
  if (!Array.isArray(texts) || !texts.length || lang === "en") return texts || [];
  const langName = languageName(lang);

  const out: string[] = new Array(texts.length);
  const missIdx: number[] = [];
  const miss: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const key = `chtr:${lang}:${hash(String(texts[i]))}`;
    const hit = await cacheGet(key).catch(() => null);
    if (typeof hit === "string") out[i] = hit;
    else { missIdx.push(i); miss.push(String(texts[i])); }
  }
  if (miss.length) {
    try {
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        model: "gpt_5_mini",
        prompt: `Translate these short chat messages to ${langName}. Return ONLY JSON {"translations":[...]} in the same order. Keep emoji, names, and @handles as-is. Do not add commentary.\n${JSON.stringify(miss)}`,
        response_json_schema: { type: "object", properties: { translations: { type: "array", items: { type: "string" } } }, required: ["translations"] },
      });
      const tr = Array.isArray(res?.translations) ? res.translations : miss;
      for (let j = 0; j < missIdx.length; j++) {
        const val = tr[j] != null ? String(tr[j]) : miss[j];
        out[missIdx[j]] = val;
        await cacheSet(`chtr:${lang}:${hash(miss[j])}`, val, TTL).catch(() => null);
      }
    } catch {
      for (let j = 0; j < missIdx.length; j++) out[missIdx[j]] = miss[j];   // fail open — show original
    }
  }
  return out;
}
