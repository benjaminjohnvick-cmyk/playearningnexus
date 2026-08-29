// referral-tiers.ts — the pure, compliant core of the TWO-TIER referral bonus:
//   • a regular USER referral pays a small Site Cash bonus (default $5) when the referred user becomes active
//   • an ADVERTISER referral pays a large Site Cash bonus (default $2,000, per advertiser tier) — but ONLY
//     after the referred advertiser's payment CLEARS and survives a clawback window, so the bonus is always
//     funded by a real paying advertiser and can't be farmed by fake sign-ups.
//
// Everything is Site Cash (non-cashable closed-loop credit), single-tier (referrer → referred; no downline),
// and the whole feature is OFF by default (REFERRAL_TIERS_ENABLED) pending counsel review. This module is
// pure/deterministic logic; the functions do the crediting via the platform's existing balance + ledger
// primitives. Compliance spine: a reward for a real outcome, never a promised income.

import { snapBool, snapNumber } from "./settings.ts";

export type ReferralKind = "user" | "advertiser";
export type AdvertiserTier = "tier1" | "tier2" | "tier3";

// ── switches + amounts (all admin-tunable; feature OFF until counsel signs off) ──────────────────────────
export const referralTiersEnabled = () => snapBool("REFERRAL_TIERS_ENABLED", false);
export const referralUserBonus = () => Math.max(0, snapNumber("REFERRAL_USER_BONUS_SITECASH", 5));
export const referralAdvertiserClawbackDays = () => Math.max(0, snapNumber("REFERRAL_ADVERTISER_CLAWBACK_DAYS", 45));
/** Whether a Site Cash referral bonus is treated as 1099-reportable income. Default ON (conservative);
 *  CONFIRM WITH COUNSEL whether non-cashable closed-loop credit is reportable in your structure. */
export const referralBonus1099Reportable = () => snapBool("REFERRAL_BONUS_1099_REPORTABLE", true);

/** The advertiser referral bonus for a given tier. Base default $2,000 applies to EVERY tier; each tier can
 *  be overridden independently (REFERRAL_ADV_BONUS_TIER1/2/3). */
export function referralAdvertiserBonus(tier?: AdvertiserTier): number {
  const base = Math.max(0, snapNumber("REFERRAL_ADVERTISER_BONUS_SITECASH", 2000));
  if (!tier) return base;
  const key = `REFERRAL_ADV_BONUS_${tier.toUpperCase()}`;
  const per = snapNumber(key, base);
  return Math.max(0, per);
}

/** The Site Cash amount for a referral, by kind (+ tier for advertisers). Pure. */
export function referralBonusAmount(kind: ReferralKind, tier?: AdvertiserTier): number {
  return kind === "advertiser" ? referralAdvertiserBonus(tier) : referralUserBonus();
}

// ── advertiser-bonus eligibility (the fraud-safe gate) ──────────────────────────────────────────────────
export interface AdvertiserBonusInput {
  payment_cleared_at?: string | null;   // ISO — set when the referred advertiser's payment actually cleared
  refunded?: boolean;                    // refunded or charged back → no bonus
  chargeback?: boolean;
  kyc_ok?: boolean;                      // referred advertiser passed identity/business verification
  self_referral?: boolean;               // referrer == referred (or same account/household) → no bonus
  already_paid?: boolean;                // bonus already credited → idempotency
  nowMs: number;
  clawbackDays?: number;
}

/** Decide whether an advertiser referral bonus may be paid NOW. Pays only after the referred advertiser's
 *  payment cleared AND the clawback window elapsed AND it wasn't refunded/charged-back, with KYC + no
 *  self-referral + not-already-paid. Returns the reason for the UI/audit. Pure. */
export function advertiserBonusEligible(i: AdvertiserBonusInput): { eligible: boolean; reason: string; clawback_days_left: number } {
  const clawbackDays = Math.max(0, i.clawbackDays ?? referralAdvertiserClawbackDays());
  if (i.already_paid) return { eligible: false, reason: "already paid", clawback_days_left: 0 };
  if (i.self_referral) return { eligible: false, reason: "self-referral — not eligible", clawback_days_left: 0 };
  if (i.kyc_ok === false) return { eligible: false, reason: "referred advertiser not KYC-verified", clawback_days_left: 0 };
  if (i.refunded || i.chargeback) return { eligible: false, reason: "referred advertiser refunded / charged back", clawback_days_left: 0 };
  const cleared = Date.parse(String(i.payment_cleared_at ?? ""));
  if (!Number.isFinite(cleared)) return { eligible: false, reason: "advertiser payment not cleared yet", clawback_days_left: clawbackDays };
  const elapsedMs = i.nowMs - cleared;
  const windowMs = clawbackDays * 86400000;
  if (elapsedMs < windowMs) {
    const left = Math.ceil((windowMs - elapsedMs) / 86400000);
    return { eligible: false, reason: `in clawback window (${left} day${left === 1 ? "" : "s"} left)`, clawback_days_left: left };
  }
  return { eligible: true, reason: "cleared + clawback elapsed", clawback_days_left: 0 };
}

/** User (non-advertiser) referral eligibility — pays once the referred user is genuinely active, no
 *  self-referral, not already paid. Small amount, so the gate is light. Pure. */
export function userBonusEligible(i: { active?: boolean; self_referral?: boolean; already_paid?: boolean }): { eligible: boolean; reason: string } {
  if (i.already_paid) return { eligible: false, reason: "already paid" };
  if (i.self_referral) return { eligible: false, reason: "self-referral — not eligible" };
  if (i.active === false) return { eligible: false, reason: "referred user not active yet" };
  return { eligible: true, reason: "active" };
}
