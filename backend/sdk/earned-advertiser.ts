// earned-advertiser.ts — the FREE "earn-to-unlock" advertiser tier + the no-upfront (participation-term)
// Tier 1 option. See FREE-EARN-TO-UNLOCK-TIER-SPEC.md.
//
// IRON RULE: NOTHING IS EVER OWED. The member pays nothing and owes nothing — no balance, no deadline
// penalty, no shortfall charge, no collection. The platform generates its value by MONETIZING the member's
// own ongoing activity over time (an internal LTV target), never as a fee or a debt. Advertiser benefits are
// GRANTED as rewards for activity (free_earn) or delivered over a participation term (noupfront_tier1).
// Stopping early forfeits ONLY the undelivered remainder — never a charge. No promised amount, ever.

import { snapBool, snapNumber, snapString } from "./settings.ts";
import {
  foundingImpressionsPerYear, foundingTermYears, tier1Perks,
  tier1AiCreativeIncluded, tier1AiSocialPostsPerMonth, tier1AnalyticsIncluded,
  tier1AbTestingIncluded, tier1FeaturedPlacement, tier1SentimentInsightsIncluded,
} from "./founding-advertiser.ts";
import { referralInternalValueUsd } from "./referral-rewards.ts";

export const EARNED_DISCLOSURES_VERSION = "1";

// ── Settings getters ──────────────────────────────────────────────────────────────────────────────────
export const freeAdvertiserTierEnabled = () => snapBool("FREE_ADVERTISER_TIER_ENABLED", true);
export const earnUnlockMetric = () => snapString("EARN_UNLOCK_METRIC", "surveys") || "surveys";
export const earnUnlockThreshold = (level: number) =>
  Math.max(0, snapNumber(`EARN_UNLOCK_THRESHOLD_${Math.min(4, Math.max(1, level))}`,
    [0, 30, 120, 300, 730][Math.min(4, Math.max(1, level))]));
export const freeTierSurveySharePct = () => Math.min(1, Math.max(0, snapNumber("FREE_TIER_SURVEY_SHARE_PCT", 0.75)));
export const freeTierTermYears = () => Math.max(0, snapNumber("FREE_TIER_TERM_YEARS", 4));
export const targetUserLtvUsd = () => Math.max(0, snapNumber("TARGET_USER_LTV_USD", 8000)); // INTERNAL only
export const noUpfrontEnabled = () => snapBool("TIER1_NOUPFRONT_ENABLED", true);
export const noUpfrontTermYears = () => Math.max(1, snapNumber("TIER1_NOUPFRONT_TERM_YEARS", 4));
export const noUpfrontActiveWindowDays = () => Math.max(1, snapNumber("TIER1_NOUPFRONT_ACTIVE_WINDOW_DAYS", 30));
export const earnedInterstitialEnabled = () => snapBool("EARNED_ADVERTISER_INTERSTITIAL_ENABLED", true);
// Weighted unlock — referrals are the heaviest, fastest path (never required).
export const earnUnlockWeighted = () => snapBool("EARN_UNLOCK_WEIGHTED", true);
export const earnWeightSurvey = () => Math.max(0, snapNumber("EARN_WEIGHT_SURVEY", 1));
export const earnWeightReferral = () => Math.max(0, snapNumber("EARN_WEIGHT_REFERRAL", 25));
export const earnWeightActiveDay = () => Math.max(0, snapNumber("EARN_WEIGHT_ACTIVE_DAY", 2));
export const earnDailyReferralGoal = () => Math.max(0, snapNumber("EARN_DAILY_REFERRAL_GOAL", 3));
export const onboardingRequireInviteStep = () => snapBool("EARN_ONBOARDING_REQUIRE_INVITE_STEP", true);

export const EARN_MODE = { FREE: "free_earn", NOUPFRONT: "noupfront_tier1" } as const;

// ── The unlock ladder — what each level GRANTS (all real deliverables; never a return, never owed) ────────
// Impression allotment ramps toward the full paid-Tier-1 yearly allotment at level 4 (parity).
function levelImpressions(level: number): number {
  const full = foundingImpressionsPerYear();
  const frac = [0, 0.05, 0.25, 0.5, 1][Math.min(4, Math.max(0, level))]; // 5% → 25% → 50% → 100%
  return Math.round(full * frac);
}

/** The cumulative grant at a given unlock level (0..4). Level 4 = parity with a paid Tier 1 package. */
export function levelGrants(level: number): Record<string, unknown> {
  const lv = Math.min(4, Math.max(0, Math.floor(level)));
  if (lv >= 4) {
    return { level: 4, name: "Earned Advertiser", impressions_per_year: levelImpressions(4), full_package: true, perks: tier1Perks() };
  }
  return {
    level: lv,
    name: ["None", "Starter", "Growing", "Established"][lv],
    impressions_per_year: levelImpressions(lv),
    ai_creative: lv >= 1 && tier1AiCreativeIncluded(),
    ai_social_posts_per_month: lv >= 2 ? tier1AiSocialPostsPerMonth() : 0,
    analytics: lv >= 2 && tier1AnalyticsIncluded(),
    ab_testing: lv >= 3 && tier1AbTestingIncluded(),
    featured_placement: lv >= 3 && tier1FeaturedPlacement(),
    sentiment_insights: lv >= 3 && tier1SentimentInsightsIncluded(),
    full_package: false,
  };
}

/** Which unlock level a given activity progress has reached (0..4). */
export function unlockLevelFor(progress: number): number {
  const p = Math.max(0, Number(progress) || 0);
  let lv = 0;
  for (let i = 1; i <= 4; i++) if (p >= earnUnlockThreshold(i)) lv = i;
  return lv;
}

/** Progress toward the NEXT level: {level, next_level, next_threshold, progress, pct_to_next}. */
export function unlockProgress(progress: number) {
  const p = Math.max(0, Number(progress) || 0);
  const level = unlockLevelFor(p);
  const next = Math.min(4, level + 1);
  const nextThreshold = level >= 4 ? earnUnlockThreshold(4) : earnUnlockThreshold(next);
  const prevThreshold = level >= 1 ? earnUnlockThreshold(level) : 0;
  const span = Math.max(1, nextThreshold - prevThreshold);
  const pct = level >= 4 ? 1 : Math.min(1, Math.max(0, (p - prevThreshold) / span));
  return { level, next_level: level >= 4 ? 4 : next, next_threshold: nextThreshold, progress: p, pct_to_next: pct, metric: earnUnlockMetric() };
}

type Dbi = { filter: (name: string, q: Record<string, unknown>, sort?: string, limit?: number) => Promise<Record<string, unknown>[]> };

/** A member's FRAUD-SCREENED qualified referrals: Referral rows they referred where the referred user has
 *  completed a first fraud-screened survey (signup_bonus_paid === true). Raw invites do NOT count. */
export async function qualifiedReferrals(dbi: Dbi, userId: string): Promise<Record<string, unknown>[]> {
  const [a, b] = await Promise.all([
    dbi.filter("Referral", { referrer_user_id: userId, signup_bonus_paid: true }, "-created_date", 5000).catch(() => []),
    dbi.filter("Referral", { referrer_id: userId, signup_bonus_paid: true }, "-created_date", 5000).catch(() => []),
  ]);
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  for (const r of [...(a || []), ...(b || [])]) { const id = String(r.id); if (!seen.has(id)) { seen.add(id); out.push(r); } }
  return out;
}

/** Full activity breakdown for a member — the pieces AND the weighted unlock score. */
export async function activityBreakdown(dbi: Dbi, userId: string, todayISO: string) {
  const [deRows, refRows] = await Promise.all([
    dbi.filter("DailyEarnings", { user_id: userId }, "-created_date", 4000).catch(() => []) as Promise<Record<string, unknown>[]>,
    qualifiedReferrals(dbi, userId),
  ]);
  const surveys = (deRows || []).reduce((s, r) => s + (Number(r.total_surveys_completed) || 0), 0);
  const activeDays = (deRows || []).filter((r) => (Number(r.total_surveys_completed) || 0) > 0 || (Number(r.total_earned) || 0) > 0).length;
  const valueGen = Math.round((deRows || []).reduce((s, r) => s + (Number(r.survey_gross) || 0), 0) * 100) / 100;
  const referrals = (refRows || []).length;
  const referralsToday = (refRows || []).filter((r) => String(r.signup_bonus_at || "").slice(0, 10) === todayISO).length;

  let score: number;
  if (earnUnlockWeighted()) {
    score = surveys * earnWeightSurvey() + referrals * earnWeightReferral() + activeDays * earnWeightActiveDay();
  } else {
    const m = earnUnlockMetric();
    score = m === "active_days" ? activeDays : m === "value_generated" ? valueGen : surveys;
  }
  score = Math.round(score * 100) / 100;
  const goal = earnDailyReferralGoal();
  return {
    surveys, active_days: activeDays, value_generated: valueGen, referrals,
    weighted: earnUnlockWeighted(), weights: { survey: earnWeightSurvey(), referral: earnWeightReferral(), active_day: earnWeightActiveDay() },
    score, daily_referral_goal: goal, referrals_today: referralsToday, hit_daily_goal: goal <= 0 ? true : referralsToday >= goal,
  };
}

/** The unlock SCORE for a member (weighted referrals + surveys + activity, or the single configured metric).
 *  This is what unlock thresholds compare against. Best-effort. */
export async function computeActivity(dbi: Dbi, userId: string, todayISO?: string): Promise<number> {
  const b = await activityBreakdown(dbi, userId, todayISO || new Date().toISOString().slice(0, 10));
  return b.score;
}

/** INTERNAL-ONLY value realization toward the ~$8,000 LTV target — NEVER shown to the customer. Each
 *  qualified referral applies its internal value ($5 default) toward the target; the platform's survey spread
 *  (its share of the user's gross survey value) also counts. This is the operator's accounting of value
 *  GENERATED from the user — not a price the user owes and not a customer-facing figure. */
export async function internalValueBreakdown(dbi: Dbi, userId: string) {
  const [deRows, refRows] = await Promise.all([
    dbi.filter("DailyEarnings", { user_id: userId }, "-created_date", 4000).catch(() => []) as Promise<Record<string, unknown>[]>,
    qualifiedReferrals(dbi, userId),
  ]);
  const referrals = (refRows || []).length;
  const perReferral = referralInternalValueUsd();                                   // $5 default
  const referralValue = Math.round(referrals * perReferral * 100) / 100;
  const grossSurvey = (deRows || []).reduce((s, r) => s + (Number(r.survey_gross) || 0), 0);
  const surveySpread = Math.round(grossSurvey * (1 - freeTierSurveySharePct()) * 100) / 100; // platform's cut
  const generated = Math.round((referralValue + surveySpread) * 100) / 100;
  const target = targetUserLtvUsd();
  const remaining = Math.max(0, Math.round((target - generated) * 100) / 100);
  return {
    target_usd: target,                     // 8000
    per_referral_usd: perReferral,          // 5
    referrals,
    referral_value_usd: referralValue,      // referrals × $5 — "knocked off" the $8k
    survey_spread_usd: surveySpread,        // platform's share of their survey revenue
    generated_usd: generated,               // total value realized so far
    remaining_usd: remaining,               // how much of the $8k is left to generate
    pct_realized: target > 0 ? Math.min(1, generated / target) : 1,
  };
}

/** Most-recent ISO day the member had activity (for participation gating). */
export function lastActiveISO(rows: Record<string, unknown>[]): string {
  let best = "";
  for (const r of rows || []) {
    const d = String(r.date || r.day || "");
    if (d && d > best && ((Number(r.total_surveys_completed) || 0) > 0 || (Number(r.total_earned) || 0) > 0)) best = d;
  }
  return best;
}

/** Is a member currently PARTICIPATING within their term? (active within the window AND within the term.)
 *  Works for BOTH the no-upfront and the free tiers — gates DELIVERY only; lapsing pauses delivery and NEVER
 *  creates a charge. A record with term_years = 0 is treated as open-ended (always within term). */
export function earnedParticipating(rec: Record<string, unknown>, todayISO: string): { participating: boolean; within_term: boolean; active: boolean } {
  const startISO = String(rec.started_at || rec.created_date || "");
  const term = Number(rec.term_years) || 0;
  const win = Number(rec.active_window_days) || noUpfrontActiveWindowDays();
  const today = Date.parse(todayISO);
  let withinTerm = true;
  if (term > 0 && startISO) { const s = Date.parse(startISO); if (!isNaN(s) && !isNaN(today)) withinTerm = (today - s) < term * 365.25 * 24 * 3600 * 1000; }
  const last = String(rec.last_active_at || "");
  let active = false;
  if (last) { const l = Date.parse(last); if (!isNaN(l) && !isNaN(today)) active = (today - l) <= win * 24 * 3600 * 1000; }
  return { participating: withinTerm && active, within_term: withinTerm, active };
}

/** Back-compat alias (no-upfront specifically). */
export function noupfrontParticipating(rec: Record<string, unknown>, todayISO: string): { participating: boolean; within_term: boolean; active: boolean } {
  return earnedParticipating(rec, todayISO);
}

/** Does this earned/no-upfront advertiser's creatives serve right now? (Gates ad delivery; never a charge.) */
export function earnedAdActive(rec: Record<string, unknown>, todayISO: string): boolean {
  if (!rec || rec.status === "stopped" || rec.status === "cancelled") return false;
  if (rec.mode === EARN_MODE.NOUPFRONT) return earnedParticipating(rec, todayISO).participating;
  // free_earn: serves once they've unlocked at least the Starter level AND (if a term applies) while they're
  // participating within the term. A lapse pauses delivery; it never charges anything.
  if ((Number(rec.unlock_level) || 0) < 1) return false;
  return (Number(rec.term_years) || 0) > 0 ? earnedParticipating(rec, todayISO).participating : true;
}

/** User-ids of earned/no-upfront advertisers whose ads should serve now (for the interstitial pool). */
export async function activeEarnedAdOwners(dbi: {
  filter: (name: string, q: Record<string, unknown>, sort?: string, limit?: number) => Promise<Record<string, unknown>[]>;
}, todayISO: string): Promise<Set<string>> {
  if (!earnedInterstitialEnabled()) return new Set<string>();
  const rows = await dbi.filter("EarnedAdvertiser", {}, "-created_date", 20000).catch(() => []) as Record<string, unknown>[];
  const owners = new Set<string>();
  for (const r of rows || []) if (earnedAdActive(r, todayISO)) owners.add(String(r.user_id));
  return owners;
}

/** Honest, plain-language disclosures for the earned/no-upfront tiers. Not legal advice; counsel-gated. */
export function earnedDisclosures(mode: string) {
  const base = {
    version: EARNED_DISCLOSURES_VERSION,
    nothing_owed:
      "This is FREE. You pay nothing and you NEVER owe anything — there is no balance, no deadline, no " +
      "penalty, and nothing is ever charged to you. If you stop, you owe nothing.",
    earned_not_bought:
      "Advertiser benefits are UNLOCKED as a reward for your own activity on the site — they are not " +
      "purchased, not financed, and not a return on any money (you put in no money).",
    no_promised_amount:
      "We do NOT promise any earnings amount or timeline. How far and how fast you unlock depends on your " +
      "own activity and on availability, which vary and are NOT guaranteed. There is no '$X per day.'",
    referrals_accelerate:
      "Referrals are the FASTEST way to unlock — each fraud-screened referral (a friend who joins and " +
      "completes a survey) counts the heaviest toward your progress, and we encourage trying for a few a day. " +
      "But referring is NEVER required: you can reach every level through your own surveys alone, there is no " +
      "penalty for not referring, and raw invites don't count — only friends who actually join and participate.",
    closed_loop:
      "Any credits are on-site value (Site Cash / ad credits) — closed-loop, not cash, and not redeemable for cash.",
  };
  if (mode === EARN_MODE.NOUPFRONT) {
    return {
      ...base,
      mode,
      how_it_works:
        "No-upfront Tier 1: you get advertiser status with $0 upfront. Your free advertising is DELIVERED over " +
        "a " + noUpfrontTermYears() + "-year participation period as you stay active on the site. This term is a " +
        "delivery schedule and a condition of the free benefit — it is NOT a contract debt and NOT an obligation " +
        "to pay. If you stop participating, delivery of the remaining free advertising simply pauses or ends; you " +
        "are never charged and never owe anything.",
    };
  }
  const freeTerm = freeTierTermYears();
  return {
    ...base,
    mode: EARN_MODE.FREE,
    how_it_works:
      "Free earn-to-unlock: use the site and complete surveys, and you progressively unlock advertiser " +
      "benefits — from a starter credit up to a full advertiser package — as a reward for your activity. Keep " +
      "as much as you unlock; owe nothing at any point.",
    participation_term: freeTerm > 0
      ? "This is a " + freeTerm + "-year participation program: you unlock and receive your advertiser " +
        "benefits over up to " + freeTerm + " years while you stay active. This term is a program length and " +
        "delivery schedule — it is NOT a contract debt and NOT an obligation to pay or to keep using the site. " +
        "If you stop, the remaining/undelivered benefits simply pause or end; you are never charged and never " +
        "owe anything."
      : "There is no fixed term — unlock benefits at your own pace; owe nothing at any point.",
  };
}
