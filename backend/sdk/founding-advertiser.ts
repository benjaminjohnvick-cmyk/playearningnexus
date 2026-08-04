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
export const foundingFullKeepCapToPrice = () => snapBool("FOUNDING_FULLKEEP_CAP_TO_PRICE", true);
export const foundingFullKeepCapExplicit = () => Math.max(0, snapNumber("FOUNDING_FULLKEEP_CAP_USD", 0));
export const foundingFullKeepYears = () => Math.max(1, snapNumber("FOUNDING_FULLKEEP_YEARS", 4));

/** The cumulative cap (USD) on a founding member's 100%-keep survey benefit. Cap = amount paid (default) or
 *  an explicit setting. NOTE: cap = payment is a return-of-capital signal; keep member copy as a variable cap,
 *  never a promise to recoup. */
export function foundingFullKeepCapUsd(rec: Record<string, unknown>): number {
  if (foundingFullKeepCapToPrice()) return Math.max(0, Number(rec.price_usd) || foundingPriceUsd());
  return foundingFullKeepCapExplicit();
}

export interface FullKeepStatus {
  cap_usd: number;
  earned_usd: number;     // cumulative full-keep earnings recorded so far
  remaining_usd: number;
  years: number;
  within_window: boolean;
  active: boolean;        // still keeping 100%? (cap not reached AND within the window AND record is active)
  ended_reason: string;   // "" | "cap_reached" | "window_elapsed" | "not_active"
}

/** Evaluate a founding member's full-keep status. `todayISO` passed in for testability. */
export function foundingFullKeepStatus(rec: Record<string, unknown>, todayISO: string): FullKeepStatus {
  const cap = foundingFullKeepCapUsd(rec);
  const earned = Math.max(0, Number(rec.fullkeep_earned_usd) || 0);
  const years = foundingFullKeepYears();
  const startISO = String(rec.fullkeep_start || rec.credit_start || rec.purchased_at || "");
  let withinWindow = true;
  if (startISO) {
    const start = Date.parse(startISO), today = Date.parse(todayISO);
    if (!isNaN(start) && !isNaN(today)) {
      withinWindow = (today - start) < years * 365.25 * 24 * 3600 * 1000;
    }
  }
  // A "live seat" keeps the founding full-keep rate: during the offer year (funded/escrowed), after launch
  // (active), AND in the failure case (launch_unmet) — where the member can still earn store credit up to the
  // cap by doing THIRD-PARTY surveys, over the 4-year window, as long as the site operates. Not refunded/
  // cancelled seats. This is variable, earned through their own survey work, and never a promise to recoup.
  const liveSeat = rec.status !== FA_STATUS.REFUNDED && rec.status !== FA_STATUS.CANCELLED;
  const capReached = cap > 0 && earned >= cap;
  const active = liveSeat && withinWindow && !capReached;
  const ended_reason = !liveSeat ? "not_active" : capReached ? "cap_reached" : !withinWindow ? "window_elapsed" : "";
  return { cap_usd: cap, earned_usd: earned, remaining_usd: Math.max(0, cap - earned), years, within_window: withinWindow, active, ended_reason };
}

/** For the survey-reward path: is this user a founding member currently keeping 100%? Returns the record too. */
export async function foundingFullKeepActive(dbi: {
  filter: (name: string, q: Record<string, unknown>, sort?: string, limit?: number) => Promise<Record<string, unknown>[]>;
}, userId: string, todayISO: string): Promise<{ active: boolean; record: Record<string, unknown> | null }> {
  // Their most recent founding seat (any status); foundingFullKeepStatus decides eligibility — this way the
  // full-keep rate also applies during the offer year and in the launch-unmet (failure) recoup case.
  const rows = await dbi.filter("FoundingAdvertiser", { user_id: userId }, "-created_date", 1).catch(() => []);
  const rec = (rows || [])[0] || null;
  if (!rec) return { active: false, record: null };
  return { active: foundingFullKeepStatus(rec, todayISO).active, record: rec };
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
    // 2) Survey earning share — the value they keep: 100% of variable survey earnings, paid as store credit
    survey_earn_share_pct: foundingSurveyEarnSharePct(),
    disclosure:
      "These are what your founding membership includes — shown in real units, not dollars, and NOT a refund " +
      "or a promised return on your payment. What you earn from surveys is paid as Site Cash — closed-loop " +
      "store credit that spends ONLY on this site, is not cash, has no cash value, and is only useful while " +
      "the store is operating.",
    // The survey earnings are deliberately framed as SEPARATE from the purchase and NOT a return.
    separate_upside:
      "As a founding member you keep 100% of what you earn from surveys (up to $8/day) — a founding rate that " +
      "applies up to a set cap, over " + foundingFullKeepYears() + " years, after which you earn at the " +
      "standard member rate. This is SEPARATE from what you're buying, is VARIABLE and NOT guaranteed (you may " +
      "earn little, and are not promised to reach the cap), is NOT a return on your payment, and is paid as " +
      "Site Cash store credit spendable only on this site. There is no cash-back or points grant — just the " +
      "surveys you choose to do.",
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
      "advertising begins delivering once the platform reaches its launch milestone.",
    founder_is_user:
      "As a founding member you are also a user of the site: you sign up, use it, and do surveys during the " +
      "first year. Because founders are the users, the launch milestone is a single count of founding members " +
      "— not founders plus a separate pool of users.",
    participation_and_feedback:
      "During the first year we will regularly ask for your feedback through surveys and use it to refine the " +
      "site's features and functions. Founding members help shape the product.",
    effort_note:
      "At the premium rate, the $8/day cap works out to roughly 8 minutes of surveys WHEN surveys are " +
      "available. Survey availability and your earnings VARY and are NOT guaranteed — some days there may be " +
      "less, or nothing, to do. This is not a promise that you will earn $8 in 8 minutes.",
    failure_recoup:
      "If the platform does not launch, your payment is still non-refundable — but as long as the site keeps " +
      "operating you can continue earning at the founding rate (you keep 100% of what you earn, up to your " +
      "founding cap) by completing THIRD-PARTY surveys, over up to " + foundingFullKeepYears() + " years. This " +
      "is VARIABLE and NOT guaranteed: you earn it through your own survey work, it depends on how many surveys " +
      "you complete and their availability, it is paid only as on-site store credit (not cash), it stops if the " +
      "site stops operating, and it is NOT a refund and NOT a promise to recoup what you paid.",
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
