// founding-rollover.ts — the founding advertiser's ROLLOVER CREDIT → upgrade, plus the conditional SIGN-UP
// store credit. All credit here is NON-CASHABLE closed-loop Site Cash. Nothing is ever owed: unmet
// conditions simply forfeit the unvested remainder — there is never a charge or a balance.
//
// COUNSEL NOTE (carried in code on purpose): the rollover credit is set EQUAL to the amount paid ($12,000
// paid → $12,000 credit). A credit pegged to the amount paid reads as return-of-capital — the exact signal
// FOUNDING_FULLKEEP_CAP_TO_PRICE was disabled to avoid. It is scoped as tightly as possible (non-cashable,
// usable ONLY toward the defined upgrade, and expiring if unused) but the framing must be reviewed. See
// FOUNDING-ROLLOVER-AND-SIGNUP-CREDIT.md.
import { snapBool, snapNumber, snapString } from "./settings.ts";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const MS_PER_DAY = 86400000;

// ── Settings getters ────────────────────────────────────────────────────────────────────────────────────
export const rolloverCreditEnabled = () => snapBool("FOUNDING_ROLLOVER_CREDIT_ENABLED", true);
export const rolloverCreditUsd = () => Math.max(0, snapNumber("FOUNDING_ROLLOVER_CREDIT_USD", 12000));
export const rolloverCreditWindowMonths = () => Math.max(1, snapNumber("FOUNDING_ROLLOVER_CREDIT_WINDOW_MONTHS", 12));
export const upgradeName = () => snapString("FOUNDING_UPGRADE_NAME", "Tier 2 — Scale") || "Tier 2 — Scale";
export const upgradePriceUsd = () => Math.max(0, snapNumber("FOUNDING_UPGRADE_PRICE_USD", 200000));

export const signupCreditUsd = () => Math.max(0, snapNumber("FOUNDING_SIGNUP_CREDIT_USD", 1000));
export const signupCreditWindowMonths = () => Math.max(1, snapNumber("FOUNDING_SIGNUP_CREDIT_WINDOW_MONTHS", 12));
export const signupRequireMonthsActive = () => Math.max(0, snapNumber("FOUNDING_SIGNUP_REQUIRE_MONTHS_ACTIVE", 12));
export const signupRequireFeedback = () => snapBool("FOUNDING_SIGNUP_REQUIRE_FEEDBACK", true);
export const signupRequireReferrals = () => Math.max(0, snapNumber("FOUNDING_SIGNUP_REQUIRE_REFERRALS", 1));

// ── Helpers ─────────────────────────────────────────────────────────────────────────────────────────────
function monthsBetween(startISO: string, todayISO: string): number {
  const s = Date.parse(startISO), t = Date.parse(todayISO || new Date().toISOString());
  if (!Number.isFinite(s) || !Number.isFinite(t) || t < s) return 0;
  return Math.floor((t - s) / (MS_PER_DAY * 30));
}
function addMonthsISO(startISO: string, months: number): string {
  const s = Date.parse(startISO);
  if (!Number.isFinite(s)) return "";
  return new Date(s + months * 30 * MS_PER_DAY).toISOString();
}

// ── Rollover credit → upgrade ───────────────────────────────────────────────────────────────────────────
export interface RolloverState {
  enabled: boolean;
  credit_usd: number;              // the granted credit (=$12,000)
  window_months: number;
  purchased_at: string;
  expires_at: string;
  within_window: boolean;
  applied_usd: number;             // how much of the credit has already been applied
  remaining_credit_usd: number;    // credit still available to roll into the upgrade
  note: string;
}

/** Compute the rollover-credit state for a founding record. `appliedUsd` is what's already been applied
 *  (read from the record); we never move money here. Non-cashable, upgrade-only, expiring. */
export function rolloverState(purchasedISO: string, todayISO: string, appliedUsd = 0): RolloverState {
  const enabled = rolloverCreditEnabled();
  const credit = rolloverCreditUsd();
  const win = rolloverCreditWindowMonths();
  const elapsed = monthsBetween(purchasedISO, todayISO);
  const within = enabled && elapsed < win;
  const applied = Math.min(credit, Math.max(0, Number(appliedUsd) || 0));
  const remaining = within ? r2(Math.max(0, credit - applied)) : 0;
  return {
    enabled,
    credit_usd: r2(credit),
    window_months: win,
    purchased_at: purchasedISO,
    expires_at: addMonthsISO(purchasedISO, win),
    within_window: within,
    applied_usd: r2(applied),
    remaining_credit_usd: remaining,
    note: within
      ? "Non-cashable store credit, usable only toward the upgrade; expires at the end of the window."
      : (enabled ? "The rollover credit window has closed; unused credit has expired (nothing owed either way)." : "Rollover credit is disabled."),
  };
}

export interface UpgradeQuote {
  upgrade_name: string;
  upgrade_price_usd: number;
  credit_available_usd: number;
  credit_applied_usd: number;
  net_price_usd: number;           // price − applied credit
  within_window: boolean;
  note: string;
}

/** A QUOTE (never a charge) for the upgrade with the rollover credit applied. `requestedApplyUsd` defaults
 *  to all available credit. Net price = upgrade price − applied credit (e.g. $200,000 − $12,000 = $188,000). */
export function upgradeQuote(roll: RolloverState, requestedApplyUsd?: number): UpgradeQuote {
  const price = upgradePriceUsd();
  const avail = roll.within_window ? roll.remaining_credit_usd : 0;
  const apply = Math.min(avail, price, requestedApplyUsd == null ? avail : Math.max(0, Number(requestedApplyUsd) || 0));
  return {
    upgrade_name: upgradeName(),
    upgrade_price_usd: r2(price),
    credit_available_usd: r2(avail),
    credit_applied_usd: r2(apply),
    net_price_usd: r2(Math.max(0, price - apply)),
    within_window: roll.within_window,
    note: "Quote only — no charge. Credit is non-cashable and applies solely to this upgrade. A real product must back this price before it is sold.",
  };
}

// ── Sign-up store credit (conditional, vests over the window) ────────────────────────────────────────────
export interface SignupCreditState {
  credit_usd: number;              // total ($1,000)
  window_months: number;
  per_month_usd: number;
  conditions: {
    feedback: { required: boolean; met: boolean };
    referrals: { required: number; have: number; met: boolean };
    months_active: { required: number; have: number; met: boolean };
  };
  gates_met: boolean;              // feedback + referral gates satisfied → vesting can proceed
  vested_months: number;
  vested_usd: number;              // spendable now
  remaining_usd: number;           // not yet vested
  fully_unlocked: boolean;
  note: string;
}

/** Vesting for the $1,000 sign-up credit. Feedback + referral are UNLOCK GATES: until both are satisfied,
 *  nothing vests. Once satisfied, the credit vests one monthly tranche per ACTIVE month, up to the window.
 *  Unmet at window end → the unvested remainder is simply forfeited (never a charge). */
export function signupCreditState(opts: {
  startISO: string; todayISO: string; monthsActive: number; feedbackGiven: boolean; referralsQualified: number;
}): SignupCreditState {
  const total = signupCreditUsd();
  const win = signupCreditWindowMonths();
  const perMonth = r2(total / win);
  const reqFeedback = signupRequireFeedback();
  const reqReferrals = signupRequireReferrals();
  const reqMonths = signupRequireMonthsActive();

  const feedbackMet = !reqFeedback || !!opts.feedbackGiven;
  const referralsMet = (Number(opts.referralsQualified) || 0) >= reqReferrals;
  const monthsActive = Math.max(0, Math.floor(Number(opts.monthsActive) || 0));
  const elapsed = monthsBetween(opts.startISO, opts.todayISO);
  const gatesMet = feedbackMet && referralsMet;

  const vestableMonths = gatesMet ? Math.min(win, elapsed, monthsActive) : 0;
  const vestedUsd = r2(Math.min(total, perMonth * vestableMonths));
  const remaining = r2(Math.max(0, total - vestedUsd));
  const fullyUnlocked = gatesMet && monthsActive >= reqMonths && vestedUsd >= total - 0.01;

  return {
    credit_usd: r2(total),
    window_months: win,
    per_month_usd: perMonth,
    conditions: {
      feedback: { required: reqFeedback, met: feedbackMet },
      referrals: { required: reqReferrals, have: Number(opts.referralsQualified) || 0, met: referralsMet },
      months_active: { required: reqMonths, have: monthsActive, met: monthsActive >= reqMonths },
    },
    gates_met: gatesMet,
    vested_months: vestableMonths,
    vested_usd: vestedUsd,
    remaining_usd: remaining,
    fully_unlocked: fullyUnlocked,
    note: gatesMet
      ? "Vesting ~monthly as you stay active. Non-cashable Site Cash; unmet time forfeits the remainder — nothing is ever owed."
      : "Give feedback and bring 1 qualified referral to start the credit vesting. Non-cashable; nothing owed if conditions aren't met.",
  };
}

/** Disclosure lines for the sign-up credit + rollover, kept honest (conditions, non-cashable, FTC referral). */
export function foundingCreditDisclosures(): string[] {
  return [
    `Sign-up bonus: $${signupCreditUsd().toLocaleString()} in store credit, vesting over ${signupCreditWindowMonths()} months as you use the app.`,
    `To unlock it you must stay active, submit feedback${signupRequireReferrals() > 0 ? `, and refer ${signupRequireReferrals()} person who becomes an active user` : ""}.`,
    "The bonus is non-cashable store credit (Site Cash), spendable only on this site. If conditions aren't met, the unvested part is forfeited — you never owe anything.",
    `Rollover credit: your $${rolloverCreditUsd().toLocaleString()} applies toward the ${upgradeName()} upgrade within ${rolloverCreditWindowMonths()} months; it is non-cashable, upgrade-only, and expires if unused.`,
    "Referral rewards: referrals must be genuine; this is a paid referral incentive and is disclosed as such.",
  ];
}
