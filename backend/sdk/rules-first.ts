// rules-first.ts — the FREE deterministic pre-pass for moderation & classification.
//
// Same shape as the survey autofill matcher: run cheap, deterministic rules FIRST and only fall back to
// the LLM for the genuinely ambiguous middle. Most chat messages are obviously fine (allow) or obviously
// bad (block) and never touch the model; most support tickets route by an obvious keyword. The AI is
// reserved for the cases the rules can't decide.

import { snapString } from "./settings.ts";

// ── Moderation ─────────────────────────────────────────────────────────────────────────────────────
export type ModDecision = "allow" | "review" | "block";
export interface ModResult { decision: ModDecision; severity: "low" | "medium" | "high" | null; reason: string | null; matched: string[]; }

// Unambiguous scam/spam signals that are safe to hard-block without a model. (Hate-speech nuance is left
// to the AI 'review' path; the admin can add clear-cut terms via MODERATION_BLOCK_TERMS.)
const SCAM_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /\b(seed\s?phrase|private\s?key|recovery\s?phrase)\b/i, reason: "crypto credential phishing" },
  { re: /\b(send|wire|transfer)\b[^.]{0,40}\b(bitcoin|btc|eth|crypto|gift\s?card)\b/i, reason: "payment scam" },
  { re: /\bfree\s+(money|cash|robux|v-?bucks|gift\s?cards?)\b[^.]{0,30}(click|link|dm|http)/i, reason: "free-money scam" },
  { re: /\b(nigerian prince|wire.?transfer fee|claim your prize)\b/i, reason: "advance-fee scam" },
];

function urlCount(t: string): number { return (t.match(/\bhttps?:\/\/\S+|\bwww\.\S+/gi) || []).length; }
function hasContactInfo(t: string): boolean {
  return /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/.test(t) || /\b(\+?\d[\d\s().-]{7,}\d)\b/.test(t);
}

/** Free moderation pre-pass. 'block' = clearly bad, 'allow' = clearly fine, 'review' = send to the AI. */
export function moderateText(text: string): ModResult {
  const t = String(text || "");
  const low = t.toLowerCase();
  if (t.trim().length < 3) return { decision: "allow", severity: null, reason: null, matched: [] };

  // Admin-managed hard-block terms (comma-separated). Empty by default.
  const blockTerms = snapString("MODERATION_BLOCK_TERMS", "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const hitTerm = blockTerms.find((w) => low.includes(w));
  if (hitTerm) return { decision: "block", severity: "high", reason: "blocked term", matched: [hitTerm] };

  for (const p of SCAM_PATTERNS) if (p.re.test(t)) return { decision: "block", severity: "high", reason: p.reason, matched: [p.reason] };

  // Softer signals → let the AI judge (spam-ish links, shared contact info, shouting).
  const signals: string[] = [];
  if (urlCount(t) >= 2) signals.push("multiple links");
  if (hasContactInfo(t)) signals.push("contact info shared");
  if (t.length > 24 && t === t.toUpperCase() && /[A-Z]/.test(t)) signals.push("all caps");
  if (/(.)\1{6,}/.test(t)) signals.push("repeated chars");
  if (signals.length) return { decision: "review", severity: "medium", reason: signals.join(", "), matched: signals };

  return { decision: "allow", severity: null, reason: null, matched: [] };
}

// ── Keyword classification (triage/routing) ─────────────────────────────────────────────────────────
export interface ClassResult { category: string | null; confidence: number; scores: Record<string, number>; }

/**
 * Free keyword classifier. `categories` maps a category name to its trigger keywords. Returns the best
 * category and a 0–1 confidence (gap-scaled, so a close call yields low confidence → caller escalates to AI).
 */
export function classifyByKeywords(text: string, categories: Record<string, string[]>): ClassResult {
  const t = ` ${String(text || "").toLowerCase()} `;
  const scores: Record<string, number> = {};
  let best: string | null = null, bestScore = 0, secondScore = 0;
  for (const [cat, words] of Object.entries(categories)) {
    let s = 0;
    for (const w of words) if (t.includes(` ${w.toLowerCase()} `) || t.includes(w.toLowerCase())) s++;
    scores[cat] = s;
    if (s > bestScore) { secondScore = bestScore; bestScore = s; best = cat; }
    else if (s > secondScore) { secondScore = s; }
  }
  if (bestScore === 0) return { category: null, confidence: 0, scores };
  const confidence = Math.max(0, Math.min(1, (bestScore - secondScore) / bestScore));
  return { category: best, confidence, scores };
}
