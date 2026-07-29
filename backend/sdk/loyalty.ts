// Loyalty & Rewards program engine (retail-loyalty reframe) — two-tier, scale-governed, indefinite.
//
// COMPLIANCE POSTURE (unchanged): points/benefits are a RETAIL LOYALTY PROGRAM — earned through
// activity, never purchased for cash, never cashable, redeemable only in-store (closed loop). Same
// structure as miles / card points / Starbucks stars. Structural risk-reducer, NOT legal advice.
//
// THE TWO-TIER MODEL (the owner's design):
//   • NON-PREMIUM users (the ~95%): pay the normal 10%-marked-up price (mostly by card). That markup is
//     the platform's margin on them. They are NOT in the loyalty program and get no points-back.
//   • PREMIUM / loyalty users (the ~5%): pay the same price but get 10% BACK IN POINTS (store credit)
//     on every purchase — effectively the markup handed back — capped at LOYALTY_ANNUAL_VALUE_CAP_USD
//     ($1,460) per program year, funded by the matched advertiser's grid payment ($6,000). The store
//     markup is charged and kept on the sale; the points-back is a separate, advertiser-funded credit,
//     so store margin is never reduced.
//
// SCALING (the eight levers):
//   1/7 — CAPACITY is a dynamic GOVERNOR, not 1:1: enrolled premium ≤ what the pooled revenue can fund
//         at the $1,460 worst-case reserve per user. As advertiser (and other) revenue grows, so does
//         capacity — automatically, and always worst-case solvent.
//   2/6 — POOLED, DIVERSIFIED revenue funds the budget (advertiser grid fees + an admin-set aggregate of
//         affiliate/ad/membership revenue), so no single stream or business is load-bearing.
//   4   — each member's benefit is capped ($1,460/yr) — far below the ~$6,000 of revenue their
//         participation attracts, so every member is self-funding with margin to spare.
//   5   — TIERED: premium (enrolled) vs non-premium (markup) — governed toward a target premium share.
//   8   — INDEFINITE: membership runs year-to-year as long as requirements are met; the annual mark is a
//         re-consent reminder, not a hard stop. The $1,460 cap resets each program year.
//
// State lives on the PremiumPPCMembership record (JSONB — no schema change) + a LoyaltyLedger audit trail.

import { snapNumber } from "./settings.ts";
import { db } from "./db.ts";
import { round2, utcDay, gridAnnualPrice } from "./premium-ppc.ts";

// ── Config knobs (money/cap knobs are on the optimizer denylist) ──────────────────────────────────
export const loyaltyDiscountPct = () => Math.min(1, Math.max(0, snapNumber("LOYALTY_PROGRAM_DISCOUNT_PCT", 0.10)));
/** Per-member per-YEAR cap on points-back value ($1,460). Back-end number; never shown to the user. */
export const loyaltyAnnualValueCap = () => round2(snapNumber("LOYALTY_ANNUAL_VALUE_CAP_USD", 1460));
export const loyaltyDailyRequirementUsd = () => round2(snapNumber("LOYALTY_DAILY_SURVEY_REQUIREMENT_USD", 8));
export const loyaltyRequiredDaysPerWeek = () => Math.max(1, Math.round(snapNumber("LOYALTY_REQUIRED_DAYS_PER_WEEK", 5)));
/** Program YEAR length (days) — for the annual $1,460 reset and the annual re-consent reminder. */
export const loyaltyYearDays = () => Math.max(1, Math.round(snapNumber("LOYALTY_TERM_DAYS", 365)));
export const loyaltyReconsentGraceDays = () => Math.max(0, Math.round(snapNumber("LOYALTY_RECONSENT_GRACE_DAYS", 30)));

// Scaling governor knobs:
/** Fraction of pooled revenue the program may commit to member benefits (safety buffer). 1.0 = reserve
 *  the full $1,460 worst-case per member against pooled revenue (still solvent even if everyone maxes). */
export const loyaltyBenefitBudgetFraction = () => Math.min(1, Math.max(0, snapNumber("LOYALTY_BENEFIT_BUDGET_FRACTION", 1)));
/** Target premium share of the user base (0.05 = 5%). 0 disables the premium-share ceiling. */
export const loyaltyTargetPremiumFraction = () => Math.min(1, Math.max(0, snapNumber("LOYALTY_TARGET_PREMIUM_FRACTION", 0.05)));
/** Admin-set aggregate of OTHER pooled revenue (affiliate commissions + ad + membership) that also funds
 *  the benefit budget — so capacity isn't advertiser-count-bound. Annualized USD. */
export const loyaltyExtraPoolUsd = () => round2(snapNumber("LOYALTY_EXTRA_POOL_USD", 0));

// Perk knobs (the value stack — all config):
export const loyaltyEarnMultiplier = () => Math.max(1, snapNumber("LOYALTY_EARN_MULTIPLIER", 1.25));
export const loyaltyRebatePct = () => Math.min(1, Math.max(0, snapNumber("LOYALTY_REBATE_PCT", 0.02)));
export const loyaltyFirstOrderPerkUsd = () => round2(snapNumber("LOYALTY_FIRST_ORDER_PERK_USD", 5));
export const loyaltyWelcomeBonusUsd = () => round2(snapNumber("LOYALTY_WELCOME_BONUS_USD", 25));
export const loyaltyFreeShipping = () => snapNumber("LOYALTY_FREE_SHIPPING", 1) !== 0;

// ── Capacity GOVERNOR (levers 1, 2, 6, 7) — replaces strict 1:1 ────────────────────────────────────
export async function activeAdvertiserCount(): Promise<number> {
  const rows = await db.filter("User", { ppc_grid_active: true }, undefined, 100000).catch(() => []);
  return (rows || []).length;
}
export async function enrolledLoyaltyCount(): Promise<number> {
  const rows = await db.filter("PremiumPPCMembership", { loyalty_enrolled: true }, undefined, 100000).catch(() => []) as Record<string, unknown>[];
  return (rows || []).filter((m) => m.status !== "ended").length;
}
async function totalUserCount(): Promise<number> {
  const rows = await db.filter("User", {}, undefined, 200000).catch(() => []);
  return (rows || []).length;
}
/** Annualized pooled revenue that can fund member benefits: advertiser grid fees + other streams. */
export async function pooledAnnualRevenueUsd(): Promise<number> {
  const advertisers = await activeAdvertiserCount();
  return round2(advertisers * gridAnnualPrice() + loyaltyExtraPoolUsd());
}
/** How many premium members the current pooled revenue can safely fund, worst-case (each reserved the
 *  full $1,460 annual cap), optionally also bounded by the target premium share of all users. */
export async function computeLoyaltyCapacity(): Promise<{ capacity: number; by_funding: number; by_share: number; pooled_usd: number }> {
  const pooled = await pooledAnnualRevenueUsd();
  const reserve = Math.max(1, loyaltyAnnualValueCap());
  const byFunding = Math.floor((pooled * loyaltyBenefitBudgetFraction()) / reserve);
  const share = loyaltyTargetPremiumFraction();
  const byShare = share > 0 ? Math.floor((await totalUserCount()) * share) : Number.POSITIVE_INFINITY;
  const capacity = Math.max(0, Math.min(byFunding, byShare));
  return { capacity, by_funding: byFunding, by_share: byShare === Infinity ? -1 : byShare, pooled_usd: pooled };
}
/** Is there an open premium slot right now? (enrolled < governed capacity). */
export async function hasLoyaltyCapacity(): Promise<{ ok: boolean; enrolled: number; capacity: number }> {
  const [{ capacity }, enrolled] = await Promise.all([computeLoyaltyCapacity(), enrolledLoyaltyCount()]);
  return { ok: enrolled < capacity, enrolled, capacity };
}

// ── Consents / membership (lever 8: indefinite) ───────────────────────────────────────────────────
/** Membership is active (indefinite) as long as it isn't ended. There is no hard term stop. */
export function withinTerm(member: Record<string, unknown> | null | undefined): boolean {
  return !!member && !!member.loyalty_enrolled && member.status !== "ended";
}
export function consentsComplete(member: Record<string, unknown> | null | undefined): boolean {
  return !!member && !!member.loyalty_enrolled && !!member.social_consent_at && !!member.annual_agreement_at;
}
/** Did the member complete TODAY's PPC-survey requirement? (a credited survey-day today.) */
export function dailyRequirementMet(member: Record<string, unknown> | null | undefined, today = utcDay()): boolean {
  if (!member) return false;
  return member.last_survey_day === today && (Number(member.sessions_credited_today) || 0) >= 1;
}
/** Annual RE-CONSENT reminder (not a hard stop): the member is asked to re-agree once a year. Membership
 *  continues; only if re-consent is overdue beyond the grace window does the benefit pause. */
export function reconsentDueMs(member: Record<string, unknown> | null | undefined): number | null {
  const base = member?.annual_agreement_at ? new Date(String(member.annual_agreement_at)).getTime() : null;
  return base == null ? null : base + loyaltyYearDays() * 86400000;
}
export function renewalDue(member: Record<string, unknown> | null | undefined, nowMs = Date.now()): boolean {
  const due = reconsentDueMs(member);
  return due != null && nowMs >= due;
}
function reconsentOverdue(member: Record<string, unknown> | null | undefined, nowMs = Date.now()): boolean {
  const due = reconsentDueMs(member);
  return due != null && nowMs >= due + loyaltyReconsentGraceDays() * 86400000;
}

// ── Per-YEAR points-back cap (lever 4) with annual reset ──────────────────────────────────────────
function yearRolledOver(member: Record<string, unknown> | null | undefined, nowMs = Date.now()): boolean {
  const start = member?.cap_year_start ? new Date(String(member.cap_year_start)).getTime() : null;
  return start == null || (nowMs - start) >= loyaltyYearDays() * 86400000;
}
export function rewardBackUsedUsd(member: Record<string, unknown> | null | undefined): number {
  return round2(Number(member?.rewardback_used_usd) || 0);
}
/** Points-back headroom left THIS program year (fresh full cap once the year has rolled over). */
export function availableThisYearUsd(member: Record<string, unknown> | null | undefined, nowMs = Date.now()): number {
  if (yearRolledOver(member, nowMs)) return loyaltyAnnualValueCap();
  return round2(Math.max(0, loyaltyAnnualValueCap() - rewardBackUsedUsd(member)));
}

/** Eligible to EARN points-back on a purchase right now? All daily steps done, consents in place,
 *  re-consent not overdue past grace, and headroom left this year. */
export function eligibleForDiscount(member: Record<string, unknown> | null | undefined, nowMs = Date.now()): boolean {
  if (!consentsComplete(member) || !withinTerm(member)) return false;
  if (reconsentOverdue(member, nowMs)) return false;
  if (!dailyRequirementMet(member)) return false;
  return availableThisYearUsd(member, nowMs) > 0;
}

/** Points-back for an eligible BASE price: 10% of the base, capped by the remaining annual headroom. */
export function quoteDiscount(member: Record<string, unknown> | null | undefined, basePriceUsd: number, nowMs = Date.now()): number {
  if (!eligibleForDiscount(member, nowMs)) return 0;
  const pct = round2(Math.max(0, Number(basePriceUsd) || 0) * loyaltyDiscountPct());
  return round2(Math.max(0, Math.min(pct, availableThisYearUsd(member, nowMs))));
}

// ── Atomic points-back accounting (platform-absorbed, advertiser-funded) ──────────────────────────
/** Record points-back the platform just granted on a captured sale: atomically advance this year's
 *  used total (resetting first if the program year rolled over), and write the audit ledger. Returns
 *  the amount actually recorded (capped at the remaining annual headroom). */
export async function recordLoyaltyDiscount(memberId: string, userId: string, amountUsd: number, ref: string, nowMs = Date.now()): Promise<number> {
  const want = round2(Math.max(0, Number(amountUsd) || 0));
  if (!memberId || want <= 0) return 0;
  for (let i = 0; i < 6; i++) {
    const m = await db.get("PremiumPPCMembership", memberId).catch(() => null) as Record<string, unknown> | null;
    if (!m) return 0;
    const rolled = yearRolledOver(m, nowMs);
    const usedStored = rewardBackUsedUsd(m);            // the CAS condition value (current stored)
    const baseUsed = rolled ? 0 : usedStored;           // logical base after a year rollover
    const grant = round2(Math.min(want, round2(Math.max(0, loyaltyAnnualValueCap() - baseUsed))));
    if (grant <= 0) return 0;
    const patch: Record<string, unknown> = { rewardback_used_usd: round2(baseUsed + grant) };
    if (rolled) patch.cap_year_start = new Date(nowMs).toISOString();
    const ok = await db.updateIf("PremiumPPCMembership", memberId, patch, { field: "rewardback_used_usd", equals: String(usedStored) }).catch(() => null);
    if (ok) { await ledger(memberId, userId, "points_back", grant, { ref, absorbed_by: "advertiser_funded" }); return grant; }
  }
  return 0;
}

async function ledger(memberId: string, userId: unknown, type: string, amountUsd: number, meta: Record<string, unknown>) {
  await db.create("LoyaltyLedger", {
    membership_id: memberId, user_id: userId ?? null, type, amount_usd: round2(amountUsd),
    meta, at: new Date().toISOString(),
  }).catch(() => null);
}

// ── The eleven value perks (config-driven descriptor) ─────────────────────────────────────────────
export function loyaltyPerks(member?: Record<string, unknown> | null): Array<{ key: string; label: string; kind: string; value: unknown; active: boolean }> {
  const enrolled = !!member?.loyalty_enrolled;
  return [
    { key: "welcome_bonus",   label: "Welcome bonus (vested over the year)",           kind: "points_usd", value: loyaltyWelcomeBonusUsd(),  active: enrolled },
    { key: "earn_over_time",  label: "Earn points-back daily as you shop",             kind: "cashback",   value: loyaltyDiscountPct(),      active: enrolled },
    { key: "earn_multiplier", label: "Active-member earn multiplier",                  kind: "multiplier", value: loyaltyEarnMultiplier(),   active: enrolled },
    { key: "member_cashback", label: "10% back in points on every purchase",           kind: "cashback",   value: loyaltyDiscountPct(),      active: enrolled },
    { key: "free_shipping",   label: "Member free shipping",                           kind: "perk",       value: loyaltyFreeShipping(),     active: enrolled },
    { key: "tiers",           label: "Status tiers (better perks the more you engage)", kind: "tier",      value: "bronze→gold",             active: enrolled },
    { key: "referral_points", label: "Refer a friend — you both earn",                 kind: "referral",   value: true,                      active: enrolled },
    { key: "purchase_rebate", label: "Extra points back on every purchase",            kind: "rebate",     value: loyaltyRebatePct(),        active: enrolled },
    { key: "streak_bonus",    label: "Streak bonuses for keeping your daily habit",    kind: "streak",     value: true,                      active: enrolled },
    { key: "first_order",     label: "First-order welcome perk",                       kind: "one_time",   value: loyaltyFirstOrderPerkUsd(), active: enrolled },
    { key: "merit_contests",  label: "Merit contests (skill-ranked, never chance)",    kind: "contest",    value: true,                      active: enrolled },
  ];
}
