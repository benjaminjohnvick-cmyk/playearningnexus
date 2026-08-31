// advance.ts — the FREE, NON-RECOURSE purchasing-power advance ("money upfront, work it off with surveys").
//
// The platform fronts a member its own store credit (Site Cash) to spend now, and recoups it ONLY from that
// member's future advertiser-funded survey rewards — a fraction each period, so earning is never fully absorbed.
// It is the cleanest structure we could reach:
//   • FREE — no fee, no interest, no late fees. Charging for the advance is what makes it look like a consumer
//     loan with a finance charge; there is no charge here.
//   • NON-RECOURSE — the member is NEVER obligated to repay in cash. Recoupment comes only out of rewards they
//     earn; at the end of the term any un-recouped balance is FORGIVEN. No debt, no collection, nothing reported.
//   • EARNED / GATED — premium members only, and only after a track record: a minimum earnings history and
//     account age (they've "shown they'll pay it back"). The first advance is small and grows toward the cap as
//     prior advances are recouped — a trust graduation (same spirit as the autonomy kernel).
// It never touches PayPal, never converts to cash, never leaves the platform — so no money transmission and no
// closed-loop break. Everything is gated OFF by default pending counsel; the sweeps move nothing while disabled.
//
// (Business note: the platform CARRIES the recoupment risk here — it fronts value it may not fully recoup. That
// risk is bounded by the eligibility gates + per-member caps + the advertiser-pool funding.)

import { snapBool, snapNumber } from "./settings.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// ── Config (OFF / conservative by default — PENDING COUNSEL) ────────────────────────────────────────────
export const advanceEnabled = () => snapBool("ADVANCE_ENABLED", false);
export const advanceMaxUsd = () => Math.max(0, snapNumber("ADVANCE_MAX_USD", 2000));
export const advancePremiumOnly = () => snapBool("ADVANCE_PREMIUM_ONLY", true);
export const advanceMinEarnHistoryUsd = () => Math.max(0, snapNumber("ADVANCE_MIN_EARN_HISTORY_USD", 50));
export const advanceMinAccountDays = () => Math.max(0, Math.round(snapNumber("ADVANCE_MIN_ACCOUNT_DAYS", 30)));
export const advanceFirstCapUsd = () => Math.max(0, snapNumber("ADVANCE_FIRST_CAP_USD", 100));
export const advanceRecoupPct = () => Math.min(1, Math.max(0, snapNumber("ADVANCE_RECOUP_PCT", 0.5)));
export const advanceYearEndForgive = () => snapBool("ADVANCE_YEAR_END_FORGIVE", true);

// ── Eligibility — the "shown they'll pay it back" gate (pure) ───────────────────────────────────────────
export interface AdvanceMember {
  isPremium: boolean;
  earnHistoryUsd: number;      // lifetime advertiser-funded rewards earned
  accountDays: number;         // account age in days
  advancesRepaid: number;      // count of prior advances fully recouped (track record)
  outstandingUsd: number;      // current un-recouped advance balance
  suspended?: boolean;
}
export interface AdvanceGate { eligible: boolean; reason: string; }

/** Can this member take a NEW advance right now? Premium (if required) + earnings history + account age + not
 *  suspended + no advance already outstanding. Pure. */
export function advanceEligible(m: AdvanceMember, cfg: {
  premiumOnly: boolean; minEarnHistory: number; minAccountDays: number;
}): AdvanceGate {
  if (!m || m.suspended === true) return { eligible: false, reason: "account on hold" };
  if (cfg.premiumOnly && !m.isPremium) return { eligible: false, reason: "premium members only" };
  if ((Number(m.outstandingUsd) || 0) > 0) return { eligible: false, reason: "an advance is already outstanding — recoup it first" };
  if ((Number(m.earnHistoryUsd) || 0) < cfg.minEarnHistory) return { eligible: false, reason: `needs $${cfg.minEarnHistory} earnings history first (track record)` };
  if ((Number(m.accountDays) || 0) < cfg.minAccountDays) return { eligible: false, reason: `account must be ${cfg.minAccountDays}+ days old` };
  return { eligible: true, reason: "eligible" };
}

/** The advance amount this member qualifies for — GRADUATED. First advance is capped small; the cap grows with
 *  each fully-recouped prior advance (they've proven they pay it back), up to the per-member max. Never exceeds
 *  their demonstrated earnings history either (don't front more than they've shown they can earn). Pure. */
export function maxAdvanceFor(m: AdvanceMember, cfg: { firstCap: number; maxCap: number }): number {
  const repaid = Math.max(0, Math.floor(Number(m.advancesRepaid) || 0));
  // Graduation: 1st = firstCap; then double each proven cycle, capped at maxCap.
  const graduated = Math.min(cfg.maxCap, cfg.firstCap * Math.pow(2, repaid));
  const byHistory = Math.max(0, Number(m.earnHistoryUsd) || 0);   // don't front more than earned to date
  return round2(Math.max(0, Math.min(graduated, byHistory, cfg.maxCap)));
}

// ── Recoupment (pure) ───────────────────────────────────────────────────────────────────────────────────
export interface RecoupResult { recoup: number; newOutstanding: number; paidToMember: number; }
/** Apply a fraction of a member's earned rewards this period to their outstanding advance. Recoups at most the
 *  outstanding balance; the remainder of their earnings is still PAID to them (recoupment never zeroes their
 *  earning). Non-recourse: never charges more than they earned, never creates a balance owed. Pure. */
export function recoupFromEarnings(outstandingUsd: number, earnedThisPeriodUsd: number, recoupPct: number): RecoupResult {
  const outstanding = Math.max(0, round2(Number(outstandingUsd) || 0));
  const earned = Math.max(0, round2(Number(earnedThisPeriodUsd) || 0));
  const pct = Math.min(1, Math.max(0, Number(recoupPct) || 0));
  if (outstanding <= 0 || earned <= 0) return { recoup: 0, newOutstanding: outstanding, paidToMember: earned };
  const recoup = round2(Math.min(outstanding, earned * pct));
  return { recoup, newOutstanding: round2(outstanding - recoup), paidToMember: round2(earned - recoup) };
}

/** Non-recourse term end: forgive whatever is left. Returns the forgiven amount; outstanding becomes 0. Pure. */
export function forgiveRemaining(outstandingUsd: number): { forgiven: number; newOutstanding: number } {
  const o = Math.max(0, round2(Number(outstandingUsd) || 0));
  return { forgiven: o, newOutstanding: 0 };
}

/** Honest disclosure for the advance. Pure. */
export function advanceDisclosure(amountUsd: number, recoupPct: number): string {
  return `You're getting ${usd(amountUsd)} in store credit to spend now — FREE (no fee, no interest, no late ` +
    `fees). We recoup it only from ${Math.round(recoupPct * 100)}% of the rewards you earn going forward, and if ` +
    `you never earn it back, it's forgiven — you will never owe cash and this is never a debt.`;
}
function usd(n: number): string { const v = Number(n) || 0; return "$" + (Number.isInteger(v) ? String(v) : v.toFixed(2)); }
