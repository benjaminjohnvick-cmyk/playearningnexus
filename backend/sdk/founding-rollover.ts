// founding-rollover.ts — the founding advertiser's UPGRADE DISCOUNT (decoupled from the payment) plus the
// conditional SIGN-UP store credit. All credit here is NON-CASHABLE closed-loop Site Cash. Nothing is ever
// owed: unmet conditions simply forfeit the unvested remainder — there is never a charge or a balance.
//
// REFRAMED PER COUNSEL: the upgrade benefit is no longer a "credit equal to the amount paid" (that read as
// return-of-capital, the exact signal FOUNDING_FULLKEEP_CAP_TO_PRICE was disabled to avoid). It is now a plain
// promotional DISCOUNT for founding advertisers, defined as a % of the UPGRADE price — it makes no reference
// to, and is not derived from, what the advertiser paid. (Filename kept for continuity.) See
// FOUNDING-ROLLOVER-AND-SIGNUP-CREDIT.md.
import { snapBool, snapNumber, snapString } from "./settings.ts";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const MS_PER_DAY = 86400000;

// ── Settings getters ────────────────────────────────────────────────────────────────────────────────────
export const upgradeDiscountEnabled = () => snapBool("FOUNDING_UPGRADE_DISCOUNT_ENABLED", true);
export const upgradeDiscountPct = () => Math.min(1, Math.max(0, snapNumber("FOUNDING_UPGRADE_DISCOUNT_PCT", 0.06)));
export const upgradeDiscountMaxUsd = () => Math.max(0, snapNumber("FOUNDING_UPGRADE_DISCOUNT_MAX_USD", 0));
export const upgradeDiscountWindowMonths = () => Math.max(1, snapNumber("FOUNDING_UPGRADE_DISCOUNT_WINDOW_MONTHS", 12));
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

// ── Founding upgrade DISCOUNT (decoupled from payment) ───────────────────────────────────────────────────
export interface UpgradeDiscountState {
  enabled: boolean;
  discount_pct: number;            // % off the upgrade price (e.g. 0.06)
  discount_usd: number;            // the dollar value of that % (capped if a cap is set)
  window_months: number;
  eligible_since: string;
  available_until: string;
  within_window: boolean;
  note: string;
}

/** The founding upgrade discount state. Derived ONLY from the upgrade price and the promo %, never from what
 *  the advertiser paid. A limited-time founding promo — when the window closes, the promo simply ends
 *  (there is no "balance" or "their money" that expires). */
export function upgradeDiscountState(eligibleSinceISO: string, todayISO: string): UpgradeDiscountState {
  const enabled = upgradeDiscountEnabled();
  const pct = upgradeDiscountPct();
  const win = upgradeDiscountWindowMonths();
  const price = upgradePriceUsd();
  const cap = upgradeDiscountMaxUsd();
  let discount = price * pct;
  if (cap > 0) discount = Math.min(discount, cap);
  const elapsed = monthsBetween(eligibleSinceISO, todayISO);
  const within = enabled && elapsed < win;
  return {
    enabled,
    discount_pct: pct,
    discount_usd: within ? r2(discount) : 0,
    window_months: win,
    eligible_since: eligibleSinceISO,
    available_until: addMonthsISO(eligibleSinceISO, win),
    within_window: within,
    note: within
      ? "A limited-time founding-advertiser discount on the upgrade, set as a % of the upgrade price — not tied to, or a return of, what you paid."
      : (enabled ? "The founding upgrade-discount window has ended." : "Founding upgrade discount is disabled."),
  };
}

export interface UpgradeQuote {
  upgrade_name: string;
  upgrade_price_usd: number;
  discount_pct: number;
  discount_usd: number;
  net_price_usd: number;           // price − founding discount
  within_window: boolean;
  note: string;
}

/** A QUOTE (never a charge) for the upgrade with the founding discount applied.
 *  Net price = upgrade price − discount (e.g. $200,000 − 6% = $188,000). */
export function upgradeQuote(state: UpgradeDiscountState): UpgradeQuote {
  const price = upgradePriceUsd();
  const discount = state.within_window ? state.discount_usd : 0;
  return {
    upgrade_name: upgradeName(),
    upgrade_price_usd: r2(price),
    discount_pct: state.discount_pct,
    discount_usd: r2(discount),
    net_price_usd: r2(Math.max(0, price - discount)),
    within_window: state.within_window,
    note: "Quote only — no charge. A founding-advertiser discount on the upgrade, decoupled from the amount paid. A real product must back this price before it is sold.",
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

/** Disclosure lines for the sign-up credit + upgrade discount, kept honest (conditions, non-cashable, FTC). */
export function foundingCreditDisclosures(): string[] {
  return [
    `Sign-up bonus: $${signupCreditUsd().toLocaleString()} in store credit, vesting over ${signupCreditWindowMonths()} months as you use the app.`,
    `To unlock it you must stay active, submit feedback${signupRequireReferrals() > 0 ? `, and refer ${signupRequireReferrals()} person who becomes an active user` : ""}.`,
    "The bonus is non-cashable store credit (Site Cash), spendable only on this site. If conditions aren't met, the unvested part is forfeited — you never owe anything.",
    `Founding upgrade discount: founding advertisers get ${Math.round(upgradeDiscountPct() * 100)}% off the ${upgradeName()} upgrade for ${upgradeDiscountWindowMonths()} months. It is a discount on the upgrade — not tied to, or a return of, what you paid.`,
    "Referral rewards: referrals must be genuine; this is a paid referral incentive and is disclosed as such.",
  ];
}
