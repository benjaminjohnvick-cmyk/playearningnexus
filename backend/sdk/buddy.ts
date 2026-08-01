// buddy.ts — paired accountability/encouragement while earning ("earn together").
//
// Two users pair up to keep each other going. This is an ENGAGEMENT mechanic (body-doubling), not a way to
// share work: buddies cheer each other on, they never compare or exchange survey ANSWERS. The chat is
// walled off from survey content (answer-wall below); crossing that line is collusion + leaks advertiser IP.
//
// Rewards stay inside the rules we've held: the buddy bonus is closed-loop Site Cash, reserve-gated, capped.
// Pairing is the ENCOURAGED DEFAULT with a solo fallback — never a hard lockout (availability, consent, and
// safety all argue against forcing social contact).

import { snapNumber, snapBool } from "./settings.ts";

export const buddyEnabled = () => snapBool("BUDDY_ENABLED", true);
export const buddyBonusPct = () => Math.min(1, Math.max(0, snapNumber("BUDDY_BONUS_PCT", 0.10)));
export const buddyBonusDailyCapUsd = () => Math.max(0, snapNumber("BUDDY_BONUS_DAILY_CAP_USD", 1));
export const buddyChatBaseDailyLimit = () => Math.max(0, Math.round(snapNumber("BUDDY_CHAT_BASE_DAILY_LIMIT", 40)));
export const buddyChatExtendedDailyLimit = () => Math.max(0, Math.round(snapNumber("BUDDY_CHAT_EXTENDED_DAILY_LIMIT", 500)));
/** Cumulative survey earnings that unlock extended chat + the opt-in in-app connect. */
export const buddyUnlockEarningsUsd = () => Math.max(0, snapNumber("BUDDY_UNLOCK_EARNINGS_USD", 9));
/** Paired earning is the non-premium DEFAULT (a nudge), but a solo fallback always exists — never a lockout. */
export const buddyDefaultNonPremium = () => snapBool("BUDDY_DEFAULT_NONPREMIUM", true);

/** Safe canned encouragements — always allowed, no free-text risk. */
export const CANNED_CHEERS = [
  "Keep going! 🔥", "You've got this 💪", "Almost there!", "Nice pace! 👏",
  "One more 👍", "Proud of you!", "Let's finish strong 🚀", "Great job! 🎉",
];

// ── Answer-wall ───────────────────────────────────────────────────────────────
// Encouragement only. We block messages that look like they're sharing survey answers/content. This is a
// coarse filter (moderation + reporting back it up), but it stops the obvious collusion attempts.
const ANSWER_PATTERNS: RegExp[] = [
  /\b(answer|answ|ans)\b/i,
  /\bquestion\s*\d+/i,
  /\bq\s*\d+\b/i,
  /\b(option|choice)\s*[a-e]\b/i,
  /\bput\s+[a-e]\b/i,
  /\bselect\s+[a-e]\b/i,
  /\bthe answer is\b/i,
  /\bpick\s+(a|b|c|d|e|option)\b/i,
];

export interface WallResult { ok: boolean; reason: string | null }

/** Returns ok:false if a message appears to share survey answers/content. */
export function answerWall(text: string): WallResult {
  const t = String(text || "").trim();
  if (!t) return { ok: false, reason: "empty" };
  if (t.length > 280) return { ok: false, reason: "too_long" };
  for (const rx of ANSWER_PATTERNS) if (rx.test(t)) return { ok: false, reason: "looks_like_answer_sharing" };
  return { ok: true, reason: null };
}

/** Is this user unlocked (cumulative survey earnings ≥ threshold) for extended chat + connect? */
export function isUnlocked(cumulativeEarningsUsd: number): boolean {
  return (Number(cumulativeEarningsUsd) || 0) >= buddyUnlockEarningsUsd();
}

export function chatDailyLimit(unlocked: boolean): number {
  return unlocked ? buddyChatExtendedDailyLimit() : buddyChatBaseDailyLimit();
}

/** The buddy bonus (USD) for a completed paired session — a % of the day's take, capped. Reserve-gate at call site. */
export function buddyBonusUsd(dayTakeUsd: number): number {
  const raw = Math.max(0, Number(dayTakeUsd) || 0) * buddyBonusPct();
  return Math.min(buddyBonusDailyCapUsd(), Math.round(raw * 100) / 100);
}

/** Order two user ids so a pair is looked up consistently. */
export function pairKey(a: string, b: string): { user_a: string; user_b: string } {
  return String(a) < String(b) ? { user_a: String(a), user_b: String(b) } : { user_a: String(b), user_b: String(a) };
}
