// tier2-scaling.ts — Tier 2 "Scale" bought in 30-day PARTS. This is PAY-AS-YOU-GO (each part is a separate
// upfront purchase), NOT financing/credit — so no lending gate applies. The total is split into equal monthly
// parts; each part runs at least TIER2_PART_MIN_DAYS, then the advertiser buys the next part and scales up
// based on results. Completing all parts within the term finishes Tier 2 (12 parts ≈ one year).
//
// Rollover discount: 5.5% (FOUNDING_UPGRADE_DISCOUNT_PCT) off each part — deliberately not 6% so the dollar
// discount ($11,000) doesn't exactly equal the $12,000 Tier 1 price. It applies in the FIRST YEAR for anyone
// rolling up from Tier 1; FOUNDING members (holders of a founding Tier 1 seat) keep it in PERPETUITY.
import { snapBool, snapNumber, snapString } from "./settings.ts";
import { upgradePriceUsd, upgradeName, upgradeDiscountPct } from "./founding-rollover.ts";
import { billingYearFactor } from "./billing-cadence.ts";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const MS_PER_DAY = 86400000;

// ── Settings getters ────────────────────────────────────────────────────────────────────────────────────
export const tier2Parts = () => Math.max(1, Math.round(snapNumber("TIER2_PARTS", 12)));
export const tier2PartMinDays = () => Math.max(1, snapNumber("TIER2_PART_MIN_DAYS", 30));
export const tier2TermMonths = () => Math.max(1, snapNumber("TIER2_TERM_MONTHS", 12));
export const tier2PartMinResultsMult = () => Math.max(0, snapNumber("TIER2_PART_MIN_RESULTS_MULT", 0));
export const tier2TermYears = () => Math.max(1, Math.round(snapNumber("TIER2_TERM_YEARS", 5)));
export const tier2ContinuationResultsMult = () => Math.max(0, snapNumber("TIER2_CONTINUATION_RESULTS_MULT", 1));
export const tier2MultiYearCommitmentOptin = () => snapBool("TIER2_MULTIYEAR_COMMITMENT_OPTIN", true);
export const tier2RenewalNoticeDays = () => Math.max(0, Math.round(snapNumber("TIER2_RENEWAL_NOTICE_DAYS", 30)));
export const tier2DiscountFirstYearOnly = () => snapBool("TIER2_DISCOUNT_FIRST_YEAR_ONLY", true);
export const tier2FoundingDiscountPerpetual = () => snapBool("TIER2_FOUNDING_DISCOUNT_PERPETUAL", true);
// Tier 2 annual price. With 13-period (four-week) pricing on, the annual = 13 four-week periods (×13/12): the
// Tier 2 value stack targets 2× of this, so value scales to keep the ~2× headline ($216,666.67 → ~$433k).
export const tier2TotalUsd = () => r2(upgradePriceUsd() * billingYearFactor()); // $200,000 → $216,666.67 (13-period)
export const tier2Name = () => upgradeName();               // "Tier 2 — Scaling"
export const tier2DiscountPct = () => upgradeDiscountPct(); // 6%

// ── Deliverables ────────────────────────────────────────────────────────────────────────────────────────
export const tier2ImpressionsPerYear = () => Math.max(0, snapNumber("TIER2_IMPRESSIONS_PER_YEAR", 3000000));
export const tier2SocialPostsPerMonth = () => Math.max(0, snapNumber("TIER2_AI_SOCIAL_POSTS_PER_MONTH", 100));
export const tier2AudiencePanelsPerYear = () => Math.max(0, snapNumber("TIER2_AUDIENCE_PANELS_PER_YEAR", 4));
export const tier2VideoViewsPerYear = () => Math.max(0, snapNumber("TIER2_VIDEO_VIEWS_PER_YEAR", 500000));
export const tier2EmailCampaignsPerYear = () => Math.max(0, snapNumber("TIER2_EMAIL_CAMPAIGNS_PER_YEAR", 12));
export const tier2SponsoredNewslettersPerYear = () => Math.max(0, snapNumber("TIER2_SPONSORED_NEWSLETTERS_PER_YEAR", 6));
export const tier2BrandLiftStudiesPerYear = () => Math.max(0, snapNumber("TIER2_BRAND_LIFT_STUDIES_PER_YEAR", 2));
export const tier2CompetitiveReportsPerYear = () => Math.max(0, snapNumber("TIER2_COMPETITIVE_REPORTS_PER_YEAR", 4));

const TIER2_PERK_LABELS: Record<string, string> = {
  premier_placement: "Premier between-survey placement (top priority, above Tier 1)",
  managed_ai_creative: "Managed AI ad creative — built & refreshed for you",
  advanced_analytics: "Advanced analytics dashboard (cohorts, real-time)",
  sentiment_insights_plus: "Enhanced sentiment insights",
  multivariate_testing: "Multivariate A/B testing",
  audience_panel_research: "Included audience-panel research",
  ai_campaign_manager: "Always-on AI campaign manager + optimization (human escalation available)",
  homepage_featured: "Homepage & category featured placement + premier sponsor wall",
  api_data_feed: "API access + data feed",
};
function humanizePerk(key: string): string {
  return TIER2_PERK_LABELS[key] || key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export interface Tier2Perk { key: string; label: string; unlocks_at_part: number; }
export function tier2PerkUnlocks(): Tier2Perk[] {
  const raw = snapString("TIER2_PERK_UNLOCKS", "");
  let map: Record<string, number> = {};
  if (raw) { try { const o = JSON.parse(raw); if (o && typeof o === "object") map = o; } catch { map = {}; } }
  if (!Object.keys(map).length) {
    map = { premier_placement: 1, managed_ai_creative: 1, advanced_analytics: 1, sentiment_insights_plus: 2, multivariate_testing: 2, audience_panel_research: 3, ai_campaign_manager: 3, homepage_featured: 6, api_data_feed: 9 };
  }
  return Object.entries(map)
    .map(([key, part]) => ({ key, label: humanizePerk(key), unlocks_at_part: Math.max(1, Math.round(Number(part) || 1)) }))
    .sort((a, b) => a.unlocks_at_part - b.unlocks_at_part);
}

export interface Tier2Deliverables {
  impressions_per_year_full: number; impressions_delivered: number;
  video_views_per_year_full: number; video_views_delivered: number;
  social_posts_per_month: number; social_posts_active: boolean;
  email_campaigns_per_year_full: number; email_campaigns_delivered: number;
  sponsored_newsletters_per_year_full: number; sponsored_newsletters_delivered: number;
  audience_panels_per_year_full: number; audience_panels_delivered: number;
  brand_lift_studies_per_year_full: number; brand_lift_studies_delivered: number;
  competitive_reports_per_year_full: number; competitive_reports_delivered: number;
  perks_unlocked: Tier2Perk[]; perks_locked: Tier2Perk[]; perks_all: Tier2Perk[];
}

/** The Tier 2 package scaled to how many parts have been bought. Quantities pro-rate by parts; perks unlock
 *  at their thresholds. `partsCompleted` = parts purchased so far. */
export function tier2Deliverables(partsCompleted: number): Tier2Deliverables {
  const parts = tier2Parts();
  const done = Math.max(0, Math.min(parts, Math.floor(Number(partsCompleted) || 0)));
  const frac = parts > 0 ? done / parts : 0;
  const perks = tier2PerkUnlocks();
  return {
    impressions_per_year_full: tier2ImpressionsPerYear(),
    impressions_delivered: Math.round(tier2ImpressionsPerYear() * frac),
    video_views_per_year_full: tier2VideoViewsPerYear(),
    video_views_delivered: Math.round(tier2VideoViewsPerYear() * frac),
    social_posts_per_month: tier2SocialPostsPerMonth(),
    social_posts_active: done >= 1,
    email_campaigns_per_year_full: tier2EmailCampaignsPerYear(),
    email_campaigns_delivered: Math.round(tier2EmailCampaignsPerYear() * frac),
    sponsored_newsletters_per_year_full: tier2SponsoredNewslettersPerYear(),
    sponsored_newsletters_delivered: Math.round(tier2SponsoredNewslettersPerYear() * frac),
    audience_panels_per_year_full: tier2AudiencePanelsPerYear(),
    audience_panels_delivered: Math.round(tier2AudiencePanelsPerYear() * frac),
    brand_lift_studies_per_year_full: tier2BrandLiftStudiesPerYear(),
    brand_lift_studies_delivered: Math.round(tier2BrandLiftStudiesPerYear() * frac),
    competitive_reports_per_year_full: tier2CompetitiveReportsPerYear(),
    competitive_reports_delivered: Math.round(tier2CompetitiveReportsPerYear() * frac),
    perks_unlocked: perks.filter((p) => done >= p.unlocks_at_part),
    perks_locked: perks.filter((p) => done < p.unlocks_at_part),
    perks_all: perks,
  };
}

// ── Multi-year (up to 5) results-gated continuation ─────────────────────────────────────────────────────
// A successful Tier 2 advertiser can continue year over year, up to TIER2_TERM_YEARS. The rules that keep a
// multi-year "stay" DEFENSIBLE rather than a coercive lock:
//   • RESULTS-GATED: a year continues only when that year's real attributed results ≥ mult × the year's cost.
//     If results fall short, the advertiser can ALWAYS exit — you never hold a losing advertiser in.
//   • CONSENT-GATED for binding: continuation is BINDING only if the advertiser voluntarily opted into the
//     multi-year term up front (recorded consent) in exchange for consideration (the locked founding discount
//     / bonus inventory). Without that opt-in, a results-warranted year is only OFFERED (declinable).
//   • NOTICE: advance renewal notice (TIER2_RENEWAL_NOTICE_DAYS) before each year renews (auto-renewal law).
export interface Tier2Continuation {
  term_years: number;
  years_completed: number;
  in_term: boolean;                 // still within the 5-year program
  results_warrant: boolean;         // last year's results ≥ mult × cost
  results_needed_usd: number;
  last_year_results_usd: number;
  committed: boolean;               // advertiser opted into the multi-year term up front (recorded consent)
  binding: boolean;                 // continuation is contractually due (committed + warranted + in term)
  offered: boolean;                 // continuation available but declinable (warranted + in term + not committed)
  may_exit: boolean;                // advertiser can stop now (never trapped)
  renewal_notice_days: number;
  next_year_number: number | null;  // the year they'd continue into (null if term done)
  reason: string;
}

/** Compute the continuation state at a YEAR boundary. `yearCostUsd` defaults to the Tier 2 year price. */
export function tier2ContinuationStatus(opts: {
  yearsCompleted: number;
  lastYearResultsUsd: number;
  committed: boolean;
  yearCostUsd?: number;
}): Tier2Continuation {
  const termYears = tier2TermYears();
  const yearsCompleted = Math.max(0, Math.floor(Number(opts.yearsCompleted) || 0));
  const cost = r2(opts.yearCostUsd != null ? Number(opts.yearCostUsd) : tier2TotalUsd());
  const mult = tier2ContinuationResultsMult();
  const results = r2(Number(opts.lastYearResultsUsd) || 0);
  const needed = r2(cost * mult);
  const inTerm = yearsCompleted < termYears;
  const warrant = mult <= 0 ? true : results >= needed;
  // Binding only with a real, voluntary up-front commitment AND results that warrant it AND still in term.
  const committed = tier2MultiYearCommitmentOptin() && !!opts.committed;
  const binding = committed && inTerm && warrant;
  const offered = inTerm && warrant && !committed;
  // The advertiser can always stop when results don't warrant it, when the term is done, or (if they never
  // committed) at any renewal. A binding, results-warranted year is the only case where they're held in.
  const mayExit = !binding;
  let reason: string;
  if (!inTerm) reason = `The ${termYears}-year Tier 2 program is complete.`;
  else if (!warrant) reason = `Last year returned $${results.toLocaleString()} vs the $${needed.toLocaleString()} needed to warrant continuing — you're free to continue, adjust, or stop.`;
  else if (binding) reason = `Results warrant continuing (returned $${results.toLocaleString()} ≥ $${needed.toLocaleString()}). Per your multi-year agreement, year ${yearsCompleted + 1} continues; you'll get ${tier2RenewalNoticeDays()} days' notice before it renews.`;
  else reason = `Results warrant continuing (returned $${results.toLocaleString()} ≥ $${needed.toLocaleString()}). Year ${yearsCompleted + 1} is available — it's your choice to continue.`;
  return {
    term_years: termYears, years_completed: yearsCompleted, in_term: inTerm,
    results_warrant: warrant, results_needed_usd: needed, last_year_results_usd: results,
    committed, binding, offered, may_exit: mayExit, renewal_notice_days: tier2RenewalNoticeDays(),
    next_year_number: inTerm ? yearsCompleted + 1 : null, reason,
  };
}

// ── The discount rule ───────────────────────────────────────────────────────────────────────────────────
/** The discount rate that applies right now. Founding members keep it forever (if perpetual is on); everyone
 *  else gets it only within the first year of Tier 2 (if first-year-only is on). */
export function tier2DiscountRate(isFounding: boolean, monthsSinceTier2Start: number): number {
  const pct = tier2DiscountPct();
  if (isFounding && tier2FoundingDiscountPerpetual()) return pct;
  if (!tier2DiscountFirstYearOnly()) return pct;          // discount never expires (admin choice)
  return (Number(monthsSinceTier2Start) || 0) < tier2TermMonths() ? pct : 0;
}

// ── The ladder ──────────────────────────────────────────────────────────────────────────────────────────
export interface Tier2Part { n: number; base_amount_usd: number; cumulative_base_usd: number; }
/** Equal parts summing exactly to the total (last part absorbs rounding). */
export function tier2Ladder(): Tier2Part[] {
  const total = tier2TotalUsd();
  const n = tier2Parts();
  const per = Math.floor((total / n) * 100) / 100;
  const parts: Tier2Part[] = [];
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const base = isLast ? r2(total - allocated) : per;
    allocated = r2(allocated + base);
    parts.push({ n: i + 1, base_amount_usd: base, cumulative_base_usd: allocated });
  }
  return parts;
}

function monthsBetween(startISO: string, todayISO: string): number {
  const s = Date.parse(startISO), t = Date.parse(todayISO || new Date().toISOString());
  if (!Number.isFinite(s) || !Number.isFinite(t) || t < s) return 0;
  return Math.floor((t - s) / (MS_PER_DAY * 30));
}

export interface Tier2Status {
  name: string; total_usd: number; parts: number; part_min_days: number; term_months: number;
  is_founding: boolean;
  parts_completed: number; complete: boolean;
  current_part_number: number | null;               // the next part to buy (1-based), null if complete
  current_part_base_usd: number | null;
  discount_pct: number;                              // effective right now
  discount_perpetual: boolean;                       // true if this member keeps it forever
  current_part_net_usd: number | null;               // base − discount
  paid_usd: number;
  next_part_eligible: boolean;
  days_until_next_part: number;                       // 0 if the 30-day gate is met
  results_gate_met: boolean;
  reason: string;
  ladder: Tier2Part[];
  deliverables: Tier2Deliverables;
}

/** Compute the status/next-part decision for a member's Tier 2 scaling plan.
 *  `rec` is their Tier2ScalingPlan row (or null if they haven't started). `lastPartResultsUsd` is the real
 *  attributed result accrued on the current part (used for the results gate). */
export function tier2Status(
  rec: Record<string, unknown> | null,
  isFounding: boolean,
  todayISO: string,
  lastPartResultsUsd = 0,
): Tier2Status {
  const ladder = tier2Ladder();
  const startedISO = String(rec?.started_at ?? todayISO);
  const partStartedISO = String(rec?.current_part_started_at ?? rec?.started_at ?? "");
  const partsCompleted = Math.max(0, Math.min(ladder.length, Number(rec?.parts_completed) || 0));
  const paidUsd = r2(Number(rec?.paid_usd) || 0);
  const complete = partsCompleted >= ladder.length;
  const monthsSinceStart = rec ? monthsBetween(startedISO, todayISO) : 0;
  const discountRate = tier2DiscountRate(isFounding, monthsSinceStart);
  const perpetual = isFounding && tier2FoundingDiscountPerpetual();

  const currentPart = complete ? null : ladder[partsCompleted];
  const base = currentPart ? currentPart.base_amount_usd : null;
  const net = base != null ? r2(base * (1 - discountRate)) : null;

  // 30-day pacing gate: only applies once at least one part is in progress.
  let daysUntil = 0, gateReason = "";
  if (rec && partStartedISO && partsCompleted > 0 && !complete) {
    const elapsedDays = (Date.parse(todayISO) - Date.parse(partStartedISO)) / MS_PER_DAY;
    const remaining = Math.ceil(tier2PartMinDays() - elapsedDays);
    if (Number.isFinite(remaining) && remaining > 0) { daysUntil = remaining; gateReason = `Current part needs ${remaining} more day(s) before you can buy the next.`; }
  }

  // Results gate: the current part must have returned at least mult × its price.
  const mult = tier2PartMinResultsMult();
  const priorBase = partsCompleted > 0 ? ladder[partsCompleted - 1].base_amount_usd : 0;
  const resultsNeeded = r2(priorBase * mult);
  const resultsMet = mult <= 0 || partsCompleted === 0 || (Number(lastPartResultsUsd) || 0) >= resultsNeeded;
  if (!resultsMet && !gateReason) gateReason = `To scale up, the last part should have returned at least $${resultsNeeded.toLocaleString()} (it has $${r2(lastPartResultsUsd).toLocaleString()}).`;

  const eligible = !complete && daysUntil === 0 && resultsMet;

  return {
    name: tier2Name(), total_usd: tier2TotalUsd(), parts: ladder.length, part_min_days: tier2PartMinDays(), term_months: tier2TermMonths(),
    is_founding: isFounding,
    parts_completed: partsCompleted, complete,
    current_part_number: currentPart ? currentPart.n : null,
    current_part_base_usd: base,
    discount_pct: discountRate, discount_perpetual: perpetual,
    current_part_net_usd: net,
    paid_usd: paidUsd,
    next_part_eligible: eligible,
    days_until_next_part: daysUntil,
    results_gate_met: resultsMet,
    reason: complete ? "Tier 2 complete — all parts purchased." : (eligible ? "Ready to buy the next part." : (gateReason || "Not eligible yet.")),
    ladder,
    deliverables: tier2Deliverables(partsCompleted),
  };
}
