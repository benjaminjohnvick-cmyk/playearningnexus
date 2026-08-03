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

/** Statuses a FoundingAdvertiser record can hold. */
export const FA_STATUS = {
  ESCROWED: "escrowed",   // paid, funds held in escrow pending the launch milestone
  ACTIVE: "active",       // milestone met — advertising is live
  REFUND_DUE: "refund_due", // milestone missed by deadline — flagged for automatic refund
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

/** Honest, plain-language disclosures shown before any founding purchase. Not legal advice; counsel-gated. */
export function foundingDisclosures() {
  return {
    version: DISCLOSURES_VERSION,
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
    escrow_and_refund:
      "Founding payments are held in escrow until the platform reaches its launch milestones — both a target " +
      "number of premium users AND a target number of founding members. If those aren't met by the stated " +
      "deadline, your payment is refunded.",
    what_you_get:
      "You receive a fixed, stated allotment of between-survey ad impressions per year for the package term, " +
      "priority placement, a locked-in rate, and membership in the closed-loop rewards ecosystem.",
  };
}
