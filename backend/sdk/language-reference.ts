// language-reference.ts — reference metadata for the translation agent: an honest estimate of how many
// languages/dialects exist, plus a PANGRAM per major script. Important framing: the pangrams are a
// DISPLAY / FONT-COVERAGE aid (a sentence that uses every letter of a script, useful for checking the app renders
// every character), NOT a translation mechanism — the LLM already knows every alphabet. Counts are estimates
// (there is no exact number of dialects). Pure.

// Estimates, refreshable from a source. There is no precise count of dialects.
export const LANGUAGE_ESTIMATE = {
  living_languages: 7000,       // ~7,000+ living languages (order of magnitude; source: Ethnologue)
  dialects_estimate: 40000,     // tens of thousands; no exact figure exists — this is a rough order of magnitude
  note: "Approximate. ~7,000 living languages; dialects number in the tens of thousands with no exact count. Refreshable from a cited source.",
};

export interface ScriptPangram { script: string; sample_language: string; pangram: string; }

/** A pangram per major script — every letter of that script appears at least once. For font/rendering coverage
 *  and display samples, not translation. (CJK/logographic scripts have no true alphabet pangram; a representative
 *  sample is used and marked.) */
export const PANGRAMS: ScriptPangram[] = [
  { script: "Latin", sample_language: "English", pangram: "The quick brown fox jumps over the lazy dog." },
  { script: "Cyrillic", sample_language: "Russian", pangram: "Съешь же ещё этих мягких французских булок да выпей чаю." },
  { script: "Greek", sample_language: "Greek", pangram: "Ξεσκεπάζω την ψυχοφθόρα βδελυγμία." },
  { script: "Arabic", sample_language: "Arabic", pangram: "نص حكيم له سر قاطع وذو شأن عظيم مكتوب على ثوب أخضر ومغلف بجلد أزرق." },
  { script: "Hebrew", sample_language: "Hebrew", pangram: "דג סקרן שט בים מאוכזב ולפתע מצא חברה." },
  { script: "Devanagari", sample_language: "Hindi", pangram: "ऋषियों को सताने वाले दुष्ट राक्षसों के राजा रावण का सर्वनाश करने वाले विष्णुवतार भगवान श्रीराम।" },
  { script: "Thai", sample_language: "Thai", pangram: "เป็นมนุษย์สุดประเสริฐเลิศคุณค่า กว่าบรรดาฝูงสัตว์เดรัจฉาน." },
  { script: "Hangul", sample_language: "Korean", pangram: "키스의 고유조건은 입술끼리 만나야 하고 특별한 기술은 필요치 않다." },
  { script: "Kana", sample_language: "Japanese", pangram: "いろはにほへと ちりぬるを わかよたれそ つねならむ (Iroha — every kana once)." },
  { script: "Han (CJK)", sample_language: "Chinese", pangram: "(Logographic — no alphabetic pangram; representative sample) 視覺設計需要檢查每個字的顯示。" },
];

const BY_SCRIPT: Record<string, ScriptPangram> = Object.fromEntries(PANGRAMS.map((p) => [p.script.toLowerCase(), p]));
export function pangramForScript(script: string): ScriptPangram | null { return BY_SCRIPT[String(script).toLowerCase()] ?? null; }
export function scriptNames(): string[] { return PANGRAMS.map((p) => p.script); }
