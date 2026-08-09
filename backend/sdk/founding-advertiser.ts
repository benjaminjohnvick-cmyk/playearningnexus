// founding-advertiser.ts — the "Tier 1" introductory advertising offer (see ADVERTISER-FUNDED-LAUNCH.md).
//
// CLEAN TIER 1 MODEL — two things sold, kept DELIBERATELY SEPARATE:
//   1) AN ADVERTISING PRODUCT, on its own merits: a fixed, stated allotment of between-survey (and social)
//      ad impressions per year for the package term, at a locked-in introductory price. This is what the
//      buyer pays for.
//   2) A STANDALONE MEMBERSHIP PERK: as a member, a Tier 1 buyer keeps 100% of what THEY earn from
//      THIRD-PARTY surveys for a time window (default 4 years), paid ONLY as closed-loop, non-cashable
//      Site Cash. NO amount is promised, there is NO cap, and it is NOT tied to, a return of, or an offset
//      to the advertising price. It is a better earning RATE (a share), never a recoup of the payment.
//
// AVAILABILITY: Tier 1 is an introductory offer, OPEN until a set number of Tier 1 advertisers enroll
//   (FOUNDING_ADVERTISER_SLOTS, default 100,000), then it CLOSES. A member who joins AFTER it closes keeps
//   only the post-Tier-1 share (TIER1_POST_SURVEY_SHARE_PCT, default 0.75 = 75%; platform fee 25%). Existing
//   Tier 1 members are unaffected. After signup, members may be offered additional advertising/spend upsells.
//
// WHAT THIS IS NOT: an investment, a security, or a promise of any financial return. NO guaranteed 2x/4x,
//   no "zero risk / guaranteed profit," no card charge tied to a survey-earnings shortfall, no cap pegged to
//   the amount paid, and no recoup framing anywhere. The presale payment is NON-REFUNDABLE and funds the
//   build/launch/user-acquisition — never used to pay a return to earlier buyers. This module tracks state
//   only; it never moves real money. Counsel-gated before any money is collected.

import { snapBool, snapNumber, snapString } from "./settings.ts";
import { db } from "./db.ts";
import { cacheGet, cacheSet } from "./cache.ts";

export const DISCLOSURES_VERSION = "2";

/** Post-Tier-1 PLATFORM FEE: the share of a post-Tier-1 member's own third-party survey revenue the
 *  platform keeps (admin-tunable in the settings panel; 0.25 = 25% fee). Legacy env override
 *  `TIER1_POST_SURVEY_SHARE_PCT` (a keep-share) still wins if explicitly set, for back-compat. */
export const tier1PostPlatformFeePct = () => Math.min(1, Math.max(0, snapNumber("TIER1_POST_PLATFORM_FEE_PCT", 0.25)));

/** Post-Tier-1 survey earn SHARE — what the member keeps (= 1 − the platform fee). What a member who joins
 *  AFTER the offer closes keeps (default 0.75 = 75%). Tier 1 members keep 100% in-window, then revert here.
 *  Derived from the admin-set platform fee; a legacy explicit share override is honored if present. */
export const tier1PostSurveySharePct = () => {
  const legacy = snapNumber("TIER1_POST_SURVEY_SHARE_PCT", -1);
  if (legacy >= 0) return Math.min(1, Math.max(0, legacy));   // back-compat: explicit share override wins
  return Math.min(1, Math.max(0, 1 - tier1PostPlatformFeePct()));
};

// ── Tier 1 VALUE STACK getters — all admin-tunable; every item is a REAL delivered feature/service, never
//    a dollar value and never a financial return. ──────────────────────────────────────────────────────
export const tier1LaunchBonusImpressions = () => Math.max(0, snapNumber("TIER1_LAUNCH_BONUS_IMPRESSIONS", 100000));
export const tier1IncludesPremium = () => snapBool("TIER1_INCLUDE_PREMIUM", true);
export const tier1AiCreativeIncluded = () => snapBool("TIER1_AI_CREATIVE_INCLUDED", true);
export const tier1AiSocialPostsPerMonth = () => Math.max(0, snapNumber("TIER1_AI_SOCIAL_POSTS_PER_MONTH", 30));
export const tier1AbTestingIncluded = () => snapBool("TIER1_AB_TESTING_INCLUDED", true);
export const tier1AnalyticsIncluded = () => snapBool("TIER1_ANALYTICS_INCLUDED", true);
export const tier1SentimentInsightsIncluded = () => snapBool("TIER1_SENTIMENT_INSIGHTS_INCLUDED", true);
export const tier1FeaturedPlacement = () => snapBool("TIER1_FEATURED_PLACEMENT", true);
export const tier1PrioritySupport = () => snapBool("TIER1_PRIORITY_SUPPORT", true);
export const tier1LockedRenewal = () => snapBool("TIER1_LOCKED_RENEWAL", true);
export const tier1EarlyAccess = () => snapBool("TIER1_EARLY_ACCESS", true);

/** The Tier 1 entitlement/perk object stamped on the record at signup — a durable record of exactly what
 *  the package includes for this member. All items are delivered features/services, not a financial return. */
export function tier1Perks(): Record<string, unknown> {
  return {
    premium_included: tier1IncludesPremium(),
    ai_creative: tier1AiCreativeIncluded(),
    ai_social_posts_per_month: tier1AiSocialPostsPerMonth(),
    ab_testing: tier1AbTestingIncluded(),
    analytics: tier1AnalyticsIncluded(),
    sentiment_insights: tier1SentimentInsightsIncluded(),
    featured_placement: tier1FeaturedPlacement(),
    priority_support: tier1PrioritySupport(),
    locked_renewal: tier1LockedRenewal(),
    early_access: tier1EarlyAccess(),
    launch_bonus_impressions: tier1LaunchBonusImpressions(),
    social_ads: foundingSocialAdsEnabled(),
  };
}

export const foundingEnabled = () => snapBool("FOUNDING_ADVERTISER_ENABLED", true);
export const foundingSlots = () => Math.max(0, snapNumber("FOUNDING_ADVERTISER_SLOTS", 100000));
export const foundingPriceUsd = () => Math.max(0, snapNumber("FOUNDING_ADVERTISER_PRICE_USD", 12000));
export const foundingMonthlyPriceUsd = () => Math.max(0, snapNumber("FOUNDING_ADVERTISER_MONTHLY_PRICE_USD", 1000));
export const foundingTermYears = () => Math.max(1, snapNumber("FOUNDING_ADVERTISER_TERM_YEARS", 4));
export const foundingImpressionsPerYear = () => Math.max(0, snapNumber("FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR", 200000));
export const foundingInterstitialPriority = () => snapBool("FOUNDING_INTERSTITIAL_PRIORITY", true);
export const foundingAutoEnrollMember = () => snapBool("FOUNDING_AUTO_ENROLL_MEMBER", true);
export const foundingEscrowRequired = () => snapBool("FOUNDING_ESCROW_REQUIRED", true);
export const foundingMilestonePremiumUsers = () => Math.max(0, snapNumber("FOUNDING_LAUNCH_MILESTONE_PREMIUM_USERS", 100000));
export const foundingMilestoneFounders = () => Math.max(0, snapNumber("FOUNDING_LAUNCH_MILESTONE_FOUNDERS", 100000));
/** Members are NEVER auto-charged for an earnings shortfall — this is coded off and must stay off. */
export const memberShortfallChargeEnabled = () => snapBool("FOUNDING_MEMBER_SHORTFALL_CHARGE", false);
export const foundingMilestoneDeadline = () => snapString("FOUNDING_LAUNCH_MILESTONE_DEADLINE", "");
export const foundingUpsellBusiness = () => snapBool("FOUNDING_UPSELL_BUSINESS_ENABLED", true);
export const foundingFundsModel = () => snapString("FOUNDING_FUNDS_MODEL", "presale"); // presale | escrow | hybrid
export const foundingNonrefundablePct = () => Math.min(1, Math.max(0, snapNumber("FOUNDING_NONREFUNDABLE_PCT", 0.25)));
export const foundingSocialAdsEnabled = () => snapBool("FOUNDING_SOCIAL_ADS_ENABLED", true);
export const foundingStoreCreditPoints = () => Math.max(0, snapNumber("FOUNDING_STORE_CREDIT_POINTS", 800000));
export const foundingStoreCreditReleaseYears = () => Math.max(1, snapNumber("FOUNDING_STORE_CREDIT_RELEASE_YEARS", 4));
export const foundingSurveyEarnSharePct = () => Math.min(1, Math.max(0, snapNumber("FOUNDING_SURVEY_EARN_SHARE_PCT", 1)));
export const foundingMissedBonusMult = () => Math.max(1, snapNumber("FOUNDING_MILESTONE_MISSED_BONUS_MULT", 1));
export const foundingFullKeepCapToPrice = () => snapBool("FOUNDING_FULLKEEP_CAP_TO_PRICE", false);
export const foundingFullKeepCapExplicit = () => Math.max(0, snapNumber("FOUNDING_FULLKEEP_CAP_USD", 0));
export const foundingFullKeepYears = () => Math.max(1, snapNumber("FOUNDING_FULLKEEP_YEARS", 4));

/** @deprecated The clean Tier 1 model has NO cap (a cap pegged to the payment reads as return-of-capital).
 *  Retained only so any legacy importer resolves; returns the (normally 0) configured cap. */
export function foundingFullKeepCapUsd(rec: Record<string, unknown>): number {
  if (foundingFullKeepCapToPrice()) return Math.max(0, Number(rec.price_usd) || foundingPriceUsd());
  return foundingFullKeepCapExplicit();
}

/** Is this record a Tier 1 (in-offer) member? True when they enrolled at the 100%-keep rate. */
export function isTier1Member(rec: Record<string, unknown>): boolean {
  if (rec.tier1 === true) return true;
  const s = Number(rec.survey_earn_share_pct);
  return Number.isFinite(s) ? s >= 1 : false;
}

export interface FullKeepStatus {
  share: number;          // the survey earn-share to apply for this member RIGHT NOW (1 = keep 100%)
  tier1: boolean;         // is this a Tier 1 (in-offer) member?
  in_window: boolean;     // still inside the Tier 1 100%-keep window?
  years: number;
  earned_usd: number;     // cumulative survey earnings recorded (reporting only; NO cap)
  active: boolean;        // is a member-rate override in effect? (a live, non-refunded/cancelled seat)
  ended_reason: string;   // "" | "window_elapsed" | "not_active"
  // legacy fields (kept so older callers still resolve; not used for gating in the Tier 1 model)
  cap_usd: number;
  remaining_usd: number;
  within_window: boolean;
}

/** Evaluate a member's current survey earn-share. Clean Tier 1 model: NO cap. A Tier 1 member keeps 100%
 *  (share = their recorded in-window share, default 1) while inside the window, then reverts to the
 *  post-Tier-1 share; a member who joined after the offer closed keeps the post-Tier-1 share throughout.
 *  `todayISO` passed in for testability. */
export function foundingFullKeepStatus(rec: Record<string, unknown>, todayISO: string): FullKeepStatus {
  const earned = Math.max(0, Number(rec.fullkeep_earned_usd) || 0);
  const years = foundingFullKeepYears();
  const startISO = String(rec.fullkeep_start || rec.credit_start || rec.purchased_at || "");
  let inWindow = true;
  if (startISO) {
    const start = Date.parse(startISO), today = Date.parse(todayISO);
    if (!isNaN(start) && !isNaN(today)) {
      inWindow = (today - start) < years * 365.25 * 24 * 3600 * 1000;
    }
  }
  // A live seat gets a member-rate override; a refunded/cancelled seat reverts to the platform standard.
  const liveSeat = rec.status !== FA_STATUS.REFUNDED && rec.status !== FA_STATUS.CANCELLED;
  const tier1 = isTier1Member(rec);
  const inWindowShare = tier1 ? Math.min(1, Math.max(0, Number(rec.survey_earn_share_pct) || 1)) : tier1PostSurveySharePct();
  // In-window Tier 1 → their 100% rate; out-of-window (or a post-Tier-1 member) → the post-Tier-1 share.
  const share = (tier1 && inWindow) ? inWindowShare : tier1PostSurveySharePct();
  const active = liveSeat;
  const ended_reason = !liveSeat ? "not_active" : (tier1 && !inWindow) ? "window_elapsed" : "";
  return {
    share, tier1, in_window: inWindow, years, earned_usd: earned, active, ended_reason,
    cap_usd: 0, remaining_usd: 0, within_window: inWindow,
  };
}

/** For the survey-reward path: the member survey earn-share override in effect for this user (if any).
 *  Returns `{ active, share, record }`. Callers apply `share` as the userSharePctOverride when active. */
export async function foundingFullKeepActive(dbi: {
  filter: (name: string, q: Record<string, unknown>, sort?: string, limit?: number) => Promise<Record<string, unknown>[]>;
}, userId: string, todayISO: string): Promise<{ active: boolean; share: number; record: Record<string, unknown> | null }> {
  const rows = await dbi.filter("FoundingAdvertiser", { user_id: userId }, "-created_date", 1).catch(() => []);
  const rec = (rows || [])[0] || null;
  if (!rec) return { active: false, share: 1, record: null };
  const st = foundingFullKeepStatus(rec, todayISO);
  return { active: st.active, share: st.share, record: rec };
}

/** Record realized survey earnings against a founding member's full-keep cap (call after crediting). Caps the
 *  increment so cumulative never exceeds the cap. Returns the updated status. */
export async function recordFoundingFullKeepEarning(dbi: {
  update: (name: string, id: string, patch: Record<string, unknown>) => Promise<unknown>;
}, rec: Record<string, unknown>, realizedUsd: number, todayISO: string): Promise<void> {
  const cap = foundingFullKeepCapUsd(rec);
  const earned = Math.max(0, Number(rec.fullkeep_earned_usd) || 0);
  const add = Math.max(0, cap > 0 ? Math.min(Number(realizedUsd) || 0, cap - earned) : (Number(realizedUsd) || 0));
  if (add <= 0) return;
  const patch: Record<string, unknown> = { fullkeep_earned_usd: Math.round((earned + add) * 100) / 100 };
  if (!rec.fullkeep_start) patch.fullkeep_start = todayISO;
  await dbi.update("FoundingAdvertiser", rec.id as string, patch).catch(() => null);
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface SignupFinancials {
  model: string;
  price_usd: number;
  spendable_usd: number;    // non-refundable revenue you may spend on ramp-up now
  escrow_usd: number;       // refundable, held in escrow until the milestone
  refundable: boolean;      // is ANY portion refundable if the milestone is missed?
}

/** Split a founding payment into the spendable (non-refundable) and escrowed (refundable) portions per the
 *  configured model. presale → all spendable; escrow → all escrowed; hybrid → deposit spendable, rest escrow. */
export function signupFinancials(): SignupFinancials {
  const price = foundingPriceUsd();
  const model = foundingFundsModel();
  if (model === "escrow") return { model, price_usd: price, spendable_usd: 0, escrow_usd: price, refundable: true };
  if (model === "hybrid") {
    const spendable = round2(price * foundingNonrefundablePct());
    return { model, price_usd: price, spendable_usd: spendable, escrow_usd: round2(price - spendable), refundable: true };
  }
  // presale (default): the whole price is non-refundable revenue that funds the ramp-up.
  return { model: "presale", price_usd: price, spendable_usd: price, escrow_usd: 0, refundable: false };
}

/** The Tier 1 offer summary — TWO deliberately separate parts: (1) the advertising product you buy (now
 *  PACKED with included features/services), and (2) a standalone membership perk (a survey earn-SHARE,
 *  never a dollar figure or a return). Everything in `included` is a delivered feature/service. */
export function foundingValueSummary() {
  const perYear = foundingImpressionsPerYear();
  const years = foundingTermYears();
  const bonus = tier1LaunchBonusImpressions();
  // The packed "everything included" stack — real deliverables only. Toggle each via settings.
  const included: { label: string; detail: string }[] = [];
  const add = (on: boolean, label: string, detail: string) => { if (on) included.push({ label, detail }); };
  add(bonus > 0, `+${bonus.toLocaleString()} launch bonus impressions`, "A one-time bonus ad allotment on top of your yearly impressions.");
  add(foundingSocialAdsEnabled(), "Runs on 2 surfaces", "Your ads run in the between-survey slot AND on the social-feed surface.");
  add(tier1FeaturedPlacement(), "Featured placement", "Priority placement in the between-survey slot plus a spot on the Tier 1 sponsors wall.");
  add(tier1AiCreativeIncluded(), "Free AI ad creative", "We draft your ad creatives and product-page copy with AI — no design work needed.");
  add(tier1AiSocialPostsPerMonth() > 0, `${tier1AiSocialPostsPerMonth()} AI social posts / month`, "Clearly-labeled AI-written social ad posts generated for you each month.");
  add(tier1AbTestingIncluded(), "Automatic A/B testing", "We test your creatives against each other and lean into the best performer.");
  add(tier1AnalyticsIncluded(), "Real-time analytics & ROI", "Live impression/click analytics and ROI reporting for every campaign.");
  add(tier1SentimentInsightsIncluded(), "Consumer-sentiment insights", "Aggregate, anonymized sentiment from responses to your ad questions (no personal data).");
  add(tier1IncludesPremium(), "Premium membership included", "You get Premium membership at no extra cost — the highest survey inventory and perks.");
  add(tier1PrioritySupport(), "Priority concierge support", "Front-of-line support for anything you need.");
  add(tier1LockedRenewal(), "Locked-in renewal rate", "Keep your introductory advertising rate at renewal for as long as you stay.");
  add(tier1EarlyAccess(), "Early access to new surfaces", "First access to new ad surfaces and features as they launch.");
  return {
    // PART 1 — the advertising PRODUCT (what you pay for), PACKED, on its own merits, in real units.
    advertising: {
      impressions_per_year: perYear,
      launch_bonus_impressions: bonus,
      impressions_total: perYear * years + bonus,
      term_years: years,
      surfaces: foundingSocialAdsEnabled() ? ["between-survey", "social feed"] : ["between-survey"],
      priority: foundingInterstitialPriority(),
      disclosure:
        "This is the advertising you are buying: a fixed, stated allotment of ad impressions per year for the " +
        "package term (plus any launch bonus), with priority placement and the included features below, at a " +
        "locked-in introductory Tier 1 price. It stands on its own.",
    },
    // Everything included with the advertising package — all delivered features/services (not a return).
    included,
    included_disclosure:
      "These are features and services INCLUDED with your advertising package — real, delivered value, not a " +
      "cash amount and not a financial return. What each is worth to you depends on how you use it.",
    // PART 2 — a SEPARATE membership perk: a survey earn-SHARE. No amount, no cap, not a return.
    survey_perk: {
      earn_share_pct: foundingSurveyEarnSharePct(),          // 1 = keep 100% of what YOU earn
      window_years: foundingFullKeepYears(),
      post_offer_share_pct: tier1PostSurveySharePct(),        // reverts to this after the window / after close
      paid_as: "Site Cash (closed-loop store credit, non-cashable)",
      disclosure:
        "SEPARATE from the advertising above: as a Tier 1 member you keep 100% of what YOU earn from " +
        "third-party surveys for " + foundingFullKeepYears() + " years — a better earning SHARE, paid only as " +
        "Site Cash (closed-loop store credit that spends only on this site, is not cash, and is useful only " +
        "while the store operates). NO amount is promised, there is NO cap, and it is NOT a return of, or an " +
        "offset to, the advertising price. Your earnings are whatever your own survey work produces, and they " +
        "VARY and are NOT guaranteed. After the window (or if you join after Tier 1 closes) you keep the " +
        "standard post-Tier-1 share (" + Math.round(tier1PostSurveySharePct() * 100) + "%).",
    },
  };
}

/** How many founding store-credit points are due to release NOW for a record (equal annual tranches).
 *  `todayISO` is passed in for testability. Points are non-cashable store credit. */
export function foundingCreditTrancheDue(rec: Record<string, unknown>, todayISO: string): number {
  const granted = Number(rec.store_credit_points_granted) || 0;
  const years = Math.max(1, Number(rec.store_credit_release_years) || foundingStoreCreditReleaseYears());
  const released = Number(rec.store_credit_points_released) || 0;
  const startISO = String(rec.credit_start || rec.purchased_at || "");
  if (!granted || !startISO) return 0;
  const start = Date.parse(startISO), today = Date.parse(todayISO);
  if (isNaN(start) || isNaN(today)) return 0;
  const yearsElapsed = Math.floor((today - start) / (365.25 * 24 * 3600 * 1000));
  const tranchesDue = Math.min(years, yearsElapsed + 1);   // first tranche on activation, then annually
  const shouldBeReleased = Math.round((granted / years) * tranchesDue);
  return Math.max(0, shouldBeReleased - released);
}

/** Statuses a FoundingAdvertiser record can hold. */
export const FA_STATUS = {
  FUNDED: "funded",       // presale/hybrid: paid, non-refundable portion is spendable revenue, awaiting launch
  ESCROWED: "escrowed",   // escrow model: paid, funds held in escrow pending the launch milestone
  ACTIVE: "active",       // milestone met — advertising is live
  REFUND_DUE: "refund_due", // escrow/hybrid milestone missed — refundable portion flagged for refund
  LAUNCH_UNMET: "launch_unmet", // presale: milestone missed by deadline — non-refundable, no money back (disclosed)
  REFUNDED: "refunded",
  CANCELLED: "cancelled",
} as const;

/** Count of founding advertisers that occupy a slot (everything not refunded/cancelled). Cached 5 min. */
export async function foundingSeatsTaken(): Promise<number> {
  const hit = await cacheGet<number>("founding_seats_taken").catch(() => null);
  if (typeof hit === "number") return hit;
  const rows = await db.filter("FoundingAdvertiser", {}, "-created_date", 200000).catch(() => []) as Record<string, unknown>[];
  const taken = (rows || []).filter((r) => r.status !== FA_STATUS.REFUNDED && r.status !== FA_STATUS.CANCELLED).length;
  await cacheSet("founding_seats_taken", taken, 300).catch(() => null);
  return taken;
}

export async function foundingSlotsRemaining(): Promise<number> {
  return Math.max(0, foundingSlots() - (await foundingSeatsTaken()));
}

export async function foundingProgramOpen(): Promise<boolean> {
  return foundingEnabled() && (await foundingSlotsRemaining()) > 0;
}

/** Count premium users on the network (drives the launch milestone). Best-effort + cached (10 min). */
export async function premiumUserCount(): Promise<number> {
  const hit = await cacheGet<number>("premium_user_count").catch(() => null);
  if (typeof hit === "number") return hit;
  const rows = await db.filter("PremiumPPCMembership", { loyalty_enrolled: true }, "-created_date", 500000).catch(() => []) as unknown[];
  const n = rows?.length || 0;
  await cacheSet("premium_user_count", n, 600).catch(() => null);
  return n;
}

export interface MilestoneState {
  // premium-user gate
  target: number;
  current: number;
  users_met: boolean;
  // founding-member gate
  founders_target: number;
  founders_current: number;
  founders_met: boolean;
  // combined
  met: boolean;             // true only when BOTH gates are met
  deadline: string;
  past_deadline: boolean;
}

/** Evaluate the launch milestone — requires BOTH 100k premium users AND 100k founding members.
 *  `todayISO` is passed in (Deno has the clock; keep this pure/testable). */
export async function milestoneState(todayISO: string): Promise<MilestoneState> {
  const target = foundingMilestonePremiumUsers();
  const foundersTarget = foundingMilestoneFounders();
  const [current, foundersCurrent] = await Promise.all([premiumUserCount(), foundingSeatsTaken()]);
  const usersMet = current >= target;
  const foundersMet = foundersCurrent >= foundersTarget;
  const deadline = foundingMilestoneDeadline();
  const past = !!deadline && todayISO > deadline;
  return {
    target, current, users_met: usersMet,
    founders_target: foundersTarget, founders_current: foundersCurrent, founders_met: foundersMet,
    met: usersMet && foundersMet,
    deadline, past_deadline: past,
  };
}

/** User-ids of active founding advertisers who still have allotment remaining this term. Cached 5 min.
 *  `dbi` is the asServiceRole entities client (passed in to avoid importing the SDK client here). */
export async function activeFoundingAdOwners(dbi: {
  filter: (name: string, q: Record<string, unknown>, sort?: string, limit?: number) => Promise<Record<string, unknown>[]>;
}): Promise<Set<string>> {
  const rows = await dbi.filter("FoundingAdvertiser", { status: FA_STATUS.ACTIVE }, "-created_date", 5000).catch(() => []);
  const cap = foundingImpressionsPerYear() * foundingTermYears();
  const owners = new Set<string>();
  for (const r of rows || []) {
    const served = Number(r.impressions_served) || 0;
    if (cap <= 0 || served < cap) owners.add(String(r.user_id));
  }
  return owners;
}

/** Increment served-impression count on an advertiser's active record (best-effort allotment metering). */
export async function noteFoundingImpression(dbi: {
  filter: (name: string, q: Record<string, unknown>, sort?: string, limit?: number) => Promise<Record<string, unknown>[]>;
  update: (name: string, id: string, patch: Record<string, unknown>) => Promise<unknown>;
}, ownerUserId: string): Promise<void> {
  const rows = await dbi.filter("FoundingAdvertiser", { user_id: ownerUserId, status: FA_STATUS.ACTIVE }, "-created_date", 1).catch(() => []);
  const rec = (rows || [])[0];
  if (!rec) return;
  await dbi.update("FoundingAdvertiser", rec.id as string, { impressions_served: (Number(rec.impressions_served) || 0) + 1 }).catch(() => null);
}

/** Honest, plain-language disclosures shown before any Tier 1 purchase. The advertising product and the
 *  survey perk are described SEPARATELY, and the survey perk carries no amount, no cap, and no recoup
 *  framing. MODEL-AWARE refund line. Not legal advice; counsel-gated before any money is collected. */
export function foundingDisclosures() {
  const model = foundingFundsModel();
  const fin = signupFinancials();
  const postPct = Math.round(tier1PostSurveySharePct() * 100);
  const base = {
    version: DISCLOSURES_VERSION,
    model,
    // ---- The advertising PRODUCT (what you pay for) ------------------------------------------------
    advertising_product:
      "WHAT YOU ARE BUYING: an advertising package — a fixed, stated allotment of between-survey (and, if " +
      "enabled, social-feed) ad impressions per year for the package term, with priority placement, at a " +
      "locked-in introductory Tier 1 price. You are buying advertising, on its own merits.",
    is_advertising_not_investment:
      "This is a purchase of advertising and membership — NOT an investment or a security. You are not buying " +
      "a financial return, and no profit, gain, or 'multiple' of your money is promised or guaranteed.",
    // ---- The SEPARATE membership perk (a survey earn-SHARE) ----------------------------------------
    survey_perk_separate:
      "SEPARATE MEMBERSHIP PERK (not part of the price of advertising): as a Tier 1 member you keep 100% of " +
      "what YOU earn from third-party surveys for " + foundingFullKeepYears() + " years — a better earning " +
      "SHARE, not a dollar figure. There is NO cap and NO promised amount. It is NOT a return of, and NOT an " +
      "offset to, what you paid for advertising. It is simply a higher share of whatever your own survey work " +
      "happens to earn.",
    survey_earnings_variable:
      "Survey availability and earnings VARY and are NOT guaranteed. Some days there may be less, or nothing, " +
      "to do. We do not promise you will earn any particular amount. Rewards are closed-loop store credit " +
      "(Site Cash) that can only be spent on this site — they are not cash and are not redeemable for cash.",
    closed_loop_site_cash:
      "All survey rewards are paid as Site Cash: closed-loop, non-cashable store credit that spends ONLY on " +
      "this site, has no cash value, cannot be transferred to another person, and is useful only while the " +
      "store is operating.",
    no_shortfall_charge:
      "You will NEVER be charged for 'falling short' of any earnings amount. There is no required earnings " +
      "figure and no card charge tied to survey results.",
    effort_note:
      "Surveys take a few minutes each when they are available. We are deliberately NOT stating a per-day or " +
      "per-minute earnings figure, because your earnings depend entirely on your own activity and on survey " +
      "availability, which vary and are not guaranteed.",
    member_is_user:
      "As a Tier 1 member you are also a user of the site: you can sign up, use it, and do surveys like any " +
      "member. Doing surveys is entirely optional and is never required to keep your advertising.",
    participation_and_feedback:
      "From time to time we may ask for your feedback through surveys and use it to refine the site. " +
      "Participating is optional.",
    // ---- Availability window + what changes after it closes ---------------------------------------
    availability_and_post_rate:
      "Tier 1 is a LIMITED introductory offer. It stays open until " + foundingSlots().toLocaleString() +
      " Tier 1 advertisers have enrolled, then it closes. Members who join AFTER it closes keep " + postPct +
      "% of their own survey earnings (the platform keeps the rest as its fee) instead of 100%. If you are " +
      "already a Tier 1 member, this change does not affect you during your window.",
    upsell_note:
      "After you join, we may offer you additional advertising or spending options. These are optional; you " +
      "are never required to buy anything further, and declining them does not affect what you already bought.",
  };

  if (model === "presale") {
    return {
      ...base,
      refund_policy:
        "IMPORTANT — THIS PAYMENT IS NON-REFUNDABLE. Your Tier 1 payment is used to build, launch, and grow " +
        "the platform (like backing a crowdfunding project). It is NOT used to pay any return to earlier " +
        "buyers. There is no guarantee the platform will succeed. If it does not, YOU WILL NOT GET YOUR MONEY " +
        "BACK. Only pay what you can afford to lose.",
    };
  }
  if (model === "hybrid") {
    return {
      ...base,
      refund_policy:
        `Of your ${fin.price_usd.toLocaleString()} payment, ${fin.spendable_usd.toLocaleString()} is a ` +
        `NON-REFUNDABLE deposit used to build/launch/grow the platform, and ${fin.escrow_usd.toLocaleString()} ` +
        "is held in escrow and refunded to you if the platform does not open. The non-refundable deposit is " +
        "not returned even if we don't launch.",
    };
  }
  // escrow
  return {
    ...base,
    refund_policy:
      "Your Tier 1 payment is held in escrow until the platform opens. If it does not open by the stated " +
      "date, your payment is refunded in full.",
  };
}
