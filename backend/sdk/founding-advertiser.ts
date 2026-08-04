// founding-advertiser.ts — the advertiser-funded launch program (see ADVERTISER-FUNDED-LAUNCH.md).
//
// WHAT THIS IS (and is NOT):
//   • IS: a limited, prepaid ADVERTISING package + closed-loop membership. Founding advertisers buy a
//     multi-year package (a fixed, stated allotment of between-survey ad impressions + perks) and are also
//     enrolled as members who can earn Site Cash from surveys like anyone.
//   • IS NOT: an investment, a security, or a promise of any financial return. There is NO guaranteed 2x/4x,
//     no "zero risk / guaranteed profit," and NO card charge tied to a survey-earnings shortfall. Member
//     survey earnings are VARIABLE, NOT GUARANTEED, and NOT an offset to the advertising cost — they are a
//     separate membership benefit, paid only as closed-loop, non-cashable Site Cash.
//   • Pre-launch: funds are ESCROWED until the premium-user milestone is met; auto-refunded if it isn't.
//     This requires a real escrow arrangement and securities/FTC counsel sign-off before it can go live.
//     This module only tracks state and flags — it never moves real money.

import { snapBool, snapNumber, snapString } from "./settings.ts";
import { db } from "./db.ts";
import { cacheGet, cacheSet } from "./cache.ts";

export const DISCLOSURES_VERSION = "1";

export const foundingEnabled = () => snapBool("FOUNDING_ADVERTISER_ENABLED", true);
export const foundingSlots = () => Math.max(0, snapNumber("FOUNDING_ADVERTISER_SLOTS", 100000));
export const foundingPriceUsd = () => Math.max(0, snapNumber("FOUNDING_ADVERTISER_PRICE_USD", 8000));
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

/** The founding VALUE PACKAGE — the "three numbers," in real deliverable units, never dollars or a return. */
export function foundingValueSummary() {
  const perYear = foundingImpressionsPerYear();
  const years = foundingTermYears();
  const credit = foundingStoreCreditPoints();
  const relYears = foundingStoreCreditReleaseYears();
  return {
    // 1) Ad reach — a concrete impression count across both surfaces
    ad_impressions_per_year: perYear,
    ad_impressions_total: perYear * years,
    ad_surfaces: foundingSocialAdsEnabled() ? ["between-survey", "social feed"] : ["between-survey"],
    // 2) Founding store credit — in points (store credit), released over the term
    store_credit_points: credit,
    store_credit_release_years: relYears,
    store_credit_points_per_year: Math.round(credit / relYears),
    // 3) Survey earning share — a share of variable earnings, not a promised amount
    survey_earn_share_pct: foundingSurveyEarnSharePct(),
    disclosure:
      "These are what your founding membership includes — shown in real units, not dollars, and NOT a refund " +
      "or a promised return on your payment. Store credit (points) is closed-loop: it spends only on this " +
      "site, is not cash, has no cash value, and is only useful while the store is operating.",
    // The extra upside is deliberately framed as SEPARATE from the purchase and NOT a return.
    separate_upside:
      "Beyond your package, you can earn more as a member — you keep 100% of what you make from surveys, and " +
      "you may receive discretionary store-credit bonuses. This upside is SEPARATE from what you're buying, " +
      "is VARIABLE and NOT guaranteed, is NOT a return on your payment, and could be little or nothing. It's " +
      "on top of the package, never a promise of getting your money back.",
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

/** Honest, plain-language disclosures shown before any founding purchase. MODEL-AWARE: in the presale model
 *  the refund line becomes a prominent NO-REFUND risk warning. Not legal advice; counsel-gated. */
export function foundingDisclosures() {
  const model = foundingFundsModel();
  const fin = signupFinancials();
  const base = {
    version: DISCLOSURES_VERSION,
    model,
    is_advertising_not_investment:
      "This is a purchase of advertising and membership — not an investment. You are not buying a financial " +
      "return, and no profit, gain, or 'multiple' of your money is promised or guaranteed.",
    survey_earnings_variable:
      "As a member you can earn rewards by completing surveys, but survey availability and earnings VARY, are " +
      "NOT guaranteed, and are NOT a repayment or offset of what you paid for advertising. Rewards are " +
      "closed-loop store credit (Site Cash) that can only be spent on this site — they are not cash and are " +
      "not redeemable for cash.",
    no_shortfall_charge:
      "You will NEVER be charged for 'falling short' of any earnings amount. There is no required earnings " +
      "figure and no card charge tied to survey results. Your survey earnings are simply whatever you earn.",
    what_you_get:
      "You receive a fixed, stated allotment of between-survey ad impressions per year for the package term, " +
      "priority placement, a locked-in rate, and membership in the closed-loop rewards ecosystem. Your " +
      "advertising begins delivering once the platform launches (both milestones met).",
  };

  if (model === "presale") {
    return {
      ...base,
      refund_policy:
        "IMPORTANT — THIS PAYMENT IS NON-REFUNDABLE. Your founding payment is used to build and launch the " +
        "platform (like backing a crowdfunding project). We aim to launch once both milestones are met, but " +
        "there is no guarantee we will. If the platform does not launch, YOU WILL NOT GET YOUR MONEY BACK. " +
        "Only pay what you can afford to lose.",
    };
  }
  if (model === "hybrid") {
    return {
      ...base,
      refund_policy:
        `Of your ${fin.price_usd.toLocaleString()} payment, ${fin.spendable_usd.toLocaleString()} is a ` +
        `NON-REFUNDABLE founding deposit used to build and launch the platform, and ` +
        `${fin.escrow_usd.toLocaleString()} is held in escrow and refunded to you if both launch milestones ` +
        "aren't met by the deadline. The non-refundable deposit is not returned even if we don't launch.",
    };
  }
  // escrow
  return {
    ...base,
    refund_policy:
      "Your founding payment is held in escrow until the platform reaches BOTH launch milestones (a target " +
      "number of premium users AND of founding members). If those aren't met by the deadline, your payment " +
      "is refunded in full.",
  };
}
