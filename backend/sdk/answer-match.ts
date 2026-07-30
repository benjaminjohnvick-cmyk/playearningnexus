// answer-match.ts — the FREE, rules-first survey answer matcher.
//
// Maps a respondent's spoken/typed words to the best multiple-choice option (a/b/c/d) using keyword
// overlap, substring match, and explicit selection cues ("option B", "the first one", "number 3"). No AI,
// no cost. The autofill flow runs this FIRST on every question; only the questions it can't confidently
// resolve get handed to the cheap-tier LLM. On plain closed-choice surveys this decides the large majority
// of answers for $0.

const STOP = new Set([
  "the", "a", "an", "and", "or", "of", "to", "is", "it", "i", "you", "my", "for", "in", "on", "with",
  "that", "this", "was", "are", "be", "do", "not", "no", "yes", "so", "me", "we", "they", "as", "at",
  "would", "will", "im", "its", "just", "really", "think", "like", "one",
]);

function norm(s: unknown): string {
  return String(s || "").toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function tokens(s: unknown): string[] {
  return norm(s).split(" ").filter((w) => w.length > 1 && !STOP.has(w));
}

/** Explicit "I pick option X" style cues → the set of option letters the text explicitly names. */
function detectCues(t: string): Set<string> {
  const cues = new Set<string>();
  const map: Record<string, string[]> = {
    a: ["a", "1", "one", "first"], b: ["b", "2", "two", "second"],
    c: ["c", "3", "three", "third"], d: ["d", "4", "four", "fourth"],
  };
  const prefixes = ["option", "answer", "choice", "number", "pick", "choose", "select", "letter", "the"];
  for (const [k, words] of Object.entries(map)) {
    for (const w of words) {
      for (const p of prefixes) {
        // "the a" is meaningless; only allow "the first/second/…" as an ordinal cue.
        if (p === "the" && !["first", "second", "third", "fourth"].includes(w)) continue;
        if (t.includes(`${p} ${w}`)) cues.add(k);
      }
    }
  }
  return cues;
}

export interface MatchResult {
  option: "a" | "b" | "c" | "d" | null;
  confidence: number;   // 0–1
  open_text: string;    // the snippet of the answer that drove the match ("you said …")
  source: "rules";
}

/** Pick the answer's most relevant sentence for the chosen option (a cheap "you said …" snippet). */
function snippetFor(text: string, optionTokens: string[]): string {
  const sentences = String(text || "").split(/[.!?\n]+/).map((s) => s.trim()).filter(Boolean);
  let best = "", bestScore = 0;
  for (const s of sentences) {
    const st = new Set(tokens(s));
    const score = optionTokens.filter((w) => st.has(w)).length;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return (bestScore > 0 ? best : (sentences.length === 1 ? sentences[0] : "")).slice(0, 200);
}

/**
 * Match one question's options against the answer text. Returns the best option + a confidence. A caller
 * treats confidence below its threshold as "let the AI decide this one".
 */
export function matchAnswer(question: Record<string, unknown>, text: string): MatchResult {
  const t = norm(text);
  const tTokens = new Set(tokens(text));
  const cues = detectCues(t);

  let best = { option: null as string | null, score: 0, tokens: [] as string[] };
  let secondScore = 0;

  for (const k of ["a", "b", "c", "d"]) {
    const label = question[`option_${k}`];
    const lNorm = norm(label);
    if (!lNorm) continue;
    const lTokens = tokens(label);

    let score = 0;
    // Whole-label substring is a strong signal (e.g. option "Red" appears in "I love the red one").
    if (lNorm.length >= 3 && t.includes(lNorm)) score = 1;
    // Token overlap: fraction of the option's meaningful words present in the answer.
    if (lTokens.length) score = Math.max(score, lTokens.filter((w) => tTokens.has(w)).length / lTokens.length);
    // Explicit selection cue for this letter.
    if (cues.has(k)) score = Math.min(1, score + 0.6);

    if (score > best.score) { secondScore = best.score; best = { option: k, score, tokens: lTokens }; }
    else if (score > secondScore) { secondScore = score; }
  }

  // Ambiguity penalty: if a runner-up is nearly as strong, drop confidence so the AI fallback takes over.
  let confidence = best.score;
  if (best.score > 0 && secondScore > 0) confidence = best.score * (1 - 0.5 * (secondScore / best.score));
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    option: best.score > 0 ? (best.option as MatchResult["option"]) : null,
    confidence,
    open_text: best.option ? snippetFor(text, best.tokens) : "",
    source: "rules",
  };
}
