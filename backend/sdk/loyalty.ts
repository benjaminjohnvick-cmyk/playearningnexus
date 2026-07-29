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

// ── Discount cap (the back-end value the user never sees) ─────────────────────────────────────────
// FUNDING MODEL: the platform ABSORBS the 10% discount (off the BASE price). It is affordable because
// each matched advertiser pays the grid price ($6,000) — far more than 10% of a normal year of that
// member's purchases. The per-member annual value cap is a SAFETY BACKSTOP so a single heavy buyer can
// never draw more discount than the advertiser payment backing them; it is a back-end number the user
// never sees. (10% off applies to ALL eligible first-party purchases up to that cap.)
export function discountUsedUsd(member: Record<string, unknown> | null | undefined): number {
  return round2(Number(member?.discount_used_usd) || 0);
}
/** Remaining discount headroom under the per-member annual cap (backstop). */
export function remainingCapUsd(member: Record<string, unknown> | null | undefined): number {
  return round2(Math.max(0, loyaltyAnnualValueCap() - discountUsedUsd(member)));
}

/** Eligible to USE the member discount on a purchase right now? All daily steps done, consents in
 *  place, within term, and still under the annual backstop cap. */
export function eligibleForDiscount(member: Record<string, unknown> | null | undefined, nowMs = Date.now()): boolean {
  if (!consentsComplete(member) || !withinTerm(member, nowMs)) return false;
  if (member?.program_complete === true) return false;              // hit the annual backstop cap
  if (!dailyRequirementMet(member)) return false;                  // must do today's steps first
  return remainingCapUsd(member) > 0;
}

/** Discount for a given eligible BASE price: 10% of the base, capped only by the remaining annual
 *  backstop. The platform absorbs this (funded by the advertiser's grid payment); it is taken off the
 *  BASE price, and the store markup is charged/kept separately, so store margin is never reduced. */
export function quoteDiscount(member: Record<string, unknown> | null | undefined, basePriceUsd: number): number {
  if (!eligibleForDiscount(member)) return 0;
  const pct = round2(Math.max(0, Number(basePriceUsd) || 0) * loyaltyDiscountPct());
  return round2(Math.max(0, Math.min(pct, remainingCapUsd(member))));
}

// ── Atomic discount accounting (platform-absorbed) ────────────────────────────────────────────────
/** Record a discount the platform just granted on a captured sale: atomically add it to the member's
 *  cumulative discount, flip the program to complete when the annual backstop cap is reached, and write
 *  the audit ledger. Returns the amount actually recorded (capped at the remaining headroom). */
export async function recordLoyaltyDiscount(memberId: string, userId: string, amountUsd: number, ref: string): Promise<number> {
  const want = round2(Math.max(0, Number(amountUsd) || 0));
  if (!memberId || want <= 0) return 0;
  for (let i = 0; i < 6; i++) {
    const m = await db.get("PremiumPPCMembership", memberId).catch(() => null) as Record<string, unknown> | null;
    if (!m) return 0;
    const used = discountUsedUsd(m);
    const grant = round2(Math.min(want, round2(Math.max(0, loyaltyAnnualValueCap() - used))));
    if (grant <= 0) {
      await db.updateIf("PremiumPPCMembership", memberId, { program_complete: true }, { field: "program_complete", equals: String(m.program_complete ?? false) }).catch(() => null);
      return 0;
    }
    const complete = round2(used + grant) >= loyaltyAnnualValueCap();
    const patch: Record<string, unknown> = { discount_used_usd: round2(used + grant) };
    if (complete) patch.program_complete = true;
    const ok = await db.updateIf("PremiumPPCMembership", memberId, patch, { field: "discount_used_usd", equals: String(used) }).catch(() => null);
    if (ok) { await ledger(memberId, userId, "discount", grant, { ref, absorbed_by: "platform_advertiser_funded" }); return grant; }
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
