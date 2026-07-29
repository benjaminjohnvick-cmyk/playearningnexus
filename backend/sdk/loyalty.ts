// Loyalty & Rewards program engine (retail-loyalty reframe).
//
// WHAT THIS IS (and the legal posture it preserves):
//   Points/benefits are a RETAIL LOYALTY PROGRAM — earned through activity, never purchased for cash,
//   never cashable, redeemable only inside our own store (closed loop). That is the same structure as
//   airline miles / credit-card points / Starbucks stars, and it is what keeps this out of
//   money-transmission / stored-value territory. This module NEVER lets a user buy points for cash or
//   cash points out. It is a structural risk-reducer, NOT legal advice or a compliance sign-off.
//
// THE VALUE MODEL (the owner's design):
//   • The benefit is a 10% MEMBER DISCOUNT on purchases, FUNDED FROM THE REVENUE THE USER GENERATED —
//     i.e. the platform's cut of the survey/PPC-ad revenue that member's daily activity produced — NOT
//     from the store markup. So the store still receives full price on every sale (margin untouched);
//     the discount is paid out of the member's own generated-revenue pool.
//   • The pool (and therefore the total discount a member can ever receive) is capped at
//     LOYALTY_ANNUAL_VALUE_CAP_USD ($1,460 = ~$4/day × 365). This is a BACK-END number the user never
//     sees — when it is reached, the discount benefit simply stops for the term.
//   • To be eligible to USE the discount on a purchase, the member must, that day, have completed the
//     daily PPC-survey requirement (LOYALTY_DAILY_SURVEY_REQUIREMENT_USD, $8 of surveys), have an active
//     social-post consent (posts carry a clear #ad disclosure), and have agreed to the one-year term.
//   • CAPACITY: rewarded members are matched 1:1 to signed-up advertiser businesses
//     (LOYALTY_CAPACITY_PER_BUSINESS). There are never more rewarded members than businesses funding
//     them — which is also what guarantees every discount is funded by real advertiser revenue.
//   • TERM + RENEWAL: a one-year term requiring ≥ LOYALTY_REQUIRED_DAYS_PER_WEEK active days/week. After
//     a full compliant year the member is asked to sign up again (renewal), not auto-renewed.
//
// It reuses the Premium PPC substrate (1:1 matching, the $1,460 ceiling, the $4/day, and the 8-min
// survey commitment in premium-ppc.ts) and stores its state on the PremiumPPCMembership record (JSONB,
// so no schema change) plus a LoyaltyLedger audit trail.

import { snapNumber } from "./settings.ts";
import { db } from "./db.ts";
import { round2, utcDay, annualEarnCeiling } from "./premium-ppc.ts";

// ── Config knobs (all live-adjustable; money/cap knobs are on the optimizer denylist) ──────────────
export const loyaltyDiscountPct = () => Math.min(1, Math.max(0, snapNumber("LOYALTY_PROGRAM_DISCOUNT_PCT", 0.10)));
/** Back-end lifetime-per-term cap on TOTAL discount value a member can receive ($1,460). Never shown. */
export const loyaltyAnnualValueCap = () => round2(snapNumber("LOYALTY_ANNUAL_VALUE_CAP_USD", annualEarnCeiling() || 1460));
/** Daily PPC-survey work a member must complete to be eligible that day ($8 of surveys). */
export const loyaltyDailyRequirementUsd = () => round2(snapNumber("LOYALTY_DAILY_SURVEY_REQUIREMENT_USD", 8));
/** The platform's cut of that day's generated revenue that funds the member's pool ($4/day → $1,460/yr). */
export const loyaltyDailyPoolAccrualUsd = () => round2(snapNumber("LOYALTY_DAILY_POOL_ACCRUAL_USD", 4));
export const loyaltyRequiredDaysPerWeek = () => Math.max(1, Math.round(snapNumber("LOYALTY_REQUIRED_DAYS_PER_WEEK", 5)));
export const loyaltyTermDays = () => Math.max(1, Math.round(snapNumber("LOYALTY_TERM_DAYS", 365)));
export const loyaltyCapacityPerBusiness = () => Math.max(0, snapNumber("LOYALTY_CAPACITY_PER_BUSINESS", 1));

// Perk knobs (the eleven value levers — all config, funded by the same generated-revenue pot):
export const loyaltyEarnMultiplier = () => Math.max(1, snapNumber("LOYALTY_EARN_MULTIPLIER", 1.25));      // (3) active-member earn multiplier
export const loyaltyRebatePct = () => Math.min(1, Math.max(0, snapNumber("LOYALTY_REBATE_PCT", 0.02)));   // (8) points rebate on purchases
export const loyaltyFirstOrderPerkUsd = () => round2(snapNumber("LOYALTY_FIRST_ORDER_PERK_USD", 5));      // (10) one-time first-order perk
export const loyaltyWelcomeBonusUsd = () => round2(snapNumber("LOYALTY_WELCOME_BONUS_USD", 25));          // (1) vested welcome bonus
export const loyaltyFreeShipping = () => snapNumber("LOYALTY_FREE_SHIPPING", 1) !== 0;                    // (5) member free shipping

// ── Capacity: rewarded members ≤ signed-up advertiser businesses (1:1) ─────────────────────────────
/** Count of advertiser businesses currently funding the program (active PPC grid). */
export async function activeAdvertiserCount(): Promise<number> {
  const rows = await db.filter("User", { ppc_grid_active: true }, undefined, 100000).catch(() => []);
  return (rows || []).length;
}
/** Count of members currently enrolled in the loyalty rewards program (active term). */
export async function enrolledLoyaltyCount(): Promise<number> {
  const rows = await db.filter("PremiumPPCMembership", { loyalty_enrolled: true }, undefined, 100000).catch(() => []) as Record<string, unknown>[];
  return (rows || []).filter((m) => m.status !== "ended" && m.program_complete !== true).length;
}
/** Is there an open rewarded-member slot? (enrolled < advertisers × ratio). */
export async function hasLoyaltyCapacity(): Promise<{ ok: boolean; enrolled: number; capacity: number }> {
  const [adv, enrolled] = await Promise.all([activeAdvertiserCount(), enrolledLoyaltyCount()]);
  const capacity = Math.floor(adv * loyaltyCapacityPerBusiness());
  return { ok: enrolled < capacity, enrolled, capacity };
}

// ── Consents / term ────────────────────────────────────────────────────────────────────────────────
export function withinTerm(member: Record<string, unknown> | null | undefined, nowMs = Date.now()): boolean {
  if (!member?.term_end) return false;
  return new Date(String(member.term_end)).getTime() > nowMs;
}
export function consentsComplete(member: Record<string, unknown> | null | undefined): boolean {
  return !!member && !!member.loyalty_enrolled && !!member.social_consent_at && !!member.annual_agreement_at;
}

/** Did the member complete TODAY's PPC-survey requirement? Uses the premium-ppc survey-day tracking
 *  (a credited survey-day today) as the signal that the day's ≈8-min / $8 requirement was met. */
export function dailyRequirementMet(member: Record<string, unknown> | null | undefined, today = utcDay()): boolean {
  if (!member) return false;
  return member.last_survey_day === today && (Number(member.sessions_credited_today) || 0) >= 1;
}

// ── Pool balance + cap (the back-end value the user never sees) ───────────────────────────────────
export function poolBalanceUsd(member: Record<string, unknown> | null | undefined): number {
  return round2(Number(member?.reward_pool_usd) || 0);
}
export function discountUsedUsd(member: Record<string, unknown> | null | undefined): number {
  return round2(Number(member?.discount_used_usd) || 0);
}
/** Remaining headroom under the $1,460 term cap (counts pool already accrued + discount already given). */
export function remainingCapUsd(member: Record<string, unknown> | null | undefined): number {
  const used = discountUsedUsd(member) + poolBalanceUsd(member);
  return round2(Math.max(0, loyaltyAnnualValueCap() - used));
}

/** Eligible to USE the member discount on a purchase right now? (all steps done + funds available). */
export function eligibleForDiscount(member: Record<string, unknown> | null | undefined, nowMs = Date.now()): boolean {
  if (!consentsComplete(member) || !withinTerm(member, nowMs)) return false;
  if (member?.program_complete === true) return false;              // hit the term cap
  if (!dailyRequirementMet(member)) return false;                  // must do today's steps first
  return poolBalanceUsd(member) > 0;                               // discount is pool-funded only
}

/** Discount for a given eligible subtotal: 10% of subtotal, but never more than the member's pool
 *  balance and never more than the remaining term cap. This is what keeps the discount funded by the
 *  member's own generated revenue and the store margin untouched. */
export function quoteDiscount(member: Record<string, unknown> | null | undefined, subtotalUsd: number): number {
  if (!eligibleForDiscount(member)) return 0;
  const pct = round2(Math.max(0, Number(subtotalUsd) || 0) * loyaltyDiscountPct());
  const capped = Math.min(pct, poolBalanceUsd(member), remainingCapUsd(member));
  return round2(Math.max(0, capped));
}

// ── Atomic pool moves ────────────────────────────────────────────────────────────────────────────
/** Accrue the day's platform cut into the member's pool, never exceeding the term cap. Atomic CAS. */
export async function accruePool(memberId: string, addUsd: number): Promise<number | null> {
  const add = round2(Math.max(0, Number(addUsd) || 0));
  if (!memberId || add <= 0) return null;
  for (let i = 0; i < 6; i++) {
    const m = await db.get("PremiumPPCMembership", memberId).catch(() => null) as Record<string, unknown> | null;
    if (!m) return null;
    const pool = poolBalanceUsd(m);
    const room = remainingCapUsd(m);
    const inc = round2(Math.min(add, room));
    if (inc <= 0) {
      // cap reached — stop the program for the term (back-end only).
      await db.updateIf("PremiumPPCMembership", memberId, { program_complete: true }, { field: "program_complete", equals: String(m.program_complete ?? false) }).catch(() => null);
      return pool;
    }
    const next = round2(pool + inc);
    const ok = await db.updateIf("PremiumPPCMembership", memberId, { reward_pool_usd: next }, { field: "reward_pool_usd", equals: String(pool) }).catch(() => null);
    if (ok) { await ledger(memberId, m.user_id, "accrual", inc, { source: "generated_revenue_cut" }); return next; }
  }
  return null;
}

/** Spend `amount` of the pool to fund a purchase discount. Atomic CAS + cap tracking + audit. Returns
 *  the amount actually funded (0 if it couldn't be committed). Store margin is untouched — this draws
 *  ONLY from the member's generated-revenue pool. */
export async function fundDiscountFromPool(memberId: string, userId: string, amountUsd: number, ref: string): Promise<number> {
  const want = round2(Math.max(0, Number(amountUsd) || 0));
  if (!memberId || want <= 0) return 0;
  for (let i = 0; i < 6; i++) {
    const m = await db.get("PremiumPPCMembership", memberId).catch(() => null) as Record<string, unknown> | null;
    if (!m) return 0;
    const pool = poolBalanceUsd(m);
    const spend = round2(Math.min(want, pool));
    if (spend <= 0) return 0;
    const used = discountUsedUsd(m);
    const complete = round2(used + spend) >= loyaltyAnnualValueCap();
    const patch: Record<string, unknown> = { reward_pool_usd: round2(pool - spend), discount_used_usd: round2(used + spend) };
    if (complete) patch.program_complete = true;
    const ok = await db.updateIf("PremiumPPCMembership", memberId, patch, { field: "reward_pool_usd", equals: String(pool) }).catch(() => null);
    if (ok) { await ledger(memberId, userId, "discount", spend, { ref }); return spend; }
  }
  return 0;
}

async function ledger(memberId: string, userId: unknown, type: string, amountUsd: number, meta: Record<string, unknown>) {
  await db.create("LoyaltyLedger", {
    membership_id: memberId, user_id: userId ?? null, type, amount_usd: round2(amountUsd),
    meta, at: new Date().toISOString(),
  }).catch(() => null);
}

// ── Renewal ──────────────────────────────────────────────────────────────────────────────────────
/** Has the member finished a full compliant term and should be asked to re-enroll? */
export function renewalDue(member: Record<string, unknown> | null | undefined, nowMs = Date.now()): boolean {
  if (!member?.loyalty_enrolled || !member.term_end) return false;
  return new Date(String(member.term_end)).getTime() <= nowMs;
}

// ── The eleven value perks, as one config-driven descriptor ────────────────────────────────────────
/** Returns the program's value stack for a member — the eleven levers, each with its live config. The
 *  money-moving ones (member discount, rebate, earn multiplier, first-order, welcome bonus) are wired
 *  in the flows; the rest are program benefits surfaced to the member and honored by their subsystems
 *  (referrals, streaks, tiers, jackpots) via their own feature flags. */
export function loyaltyPerks(member?: Record<string, unknown> | null): Array<{ key: string; label: string; kind: string; value: unknown; active: boolean }> {
  const enrolled = !!member?.loyalty_enrolled;
  return [
    { key: "welcome_bonus",   label: "Welcome bonus (vested over the term)",           kind: "points_usd", value: loyaltyWelcomeBonusUsd(),  active: enrolled },
    { key: "earn_over_time",  label: "Earn value daily as you complete your surveys",  kind: "accrual",    value: loyaltyDailyPoolAccrualUsd(), active: enrolled },
    { key: "earn_multiplier", label: "Active-member earn multiplier",                  kind: "multiplier", value: loyaltyEarnMultiplier(),   active: enrolled },
    { key: "member_discount", label: "10% member discount (funded by your activity)",  kind: "discount",   value: loyaltyDiscountPct(),      active: enrolled },
    { key: "free_shipping",   label: "Member free shipping",                           kind: "perk",       value: loyaltyFreeShipping(),     active: enrolled },
    { key: "tiers",           label: "Status tiers (better perks the more you engage)", kind: "tier",      value: "bronze→gold",             active: enrolled },
    { key: "referral_points", label: "Refer a friend — you both earn",                 kind: "referral",   value: true,                      active: enrolled },
    { key: "purchase_rebate", label: "Points back on every purchase",                  kind: "rebate",     value: loyaltyRebatePct(),        active: enrolled },
    { key: "streak_bonus",    label: "Streak bonuses for keeping your daily habit",    kind: "streak",     value: true,                      active: enrolled },
    { key: "first_order",     label: "First-order welcome perk",                       kind: "one_time",   value: loyaltyFirstOrderPerkUsd(), active: enrolled },
    { key: "merit_contests",  label: "Merit contests (skill-ranked, never chance)",    kind: "contest",    value: true,                      active: enrolled },
  ];
}
