// referral-rewards.ts — the AFFILIATE referral rewards: a one-time activation bonus + an ongoing
// single-level override on a referral's survey earnings. Designed to stay clear of pyramid/MLM law:
//
//   • SINGLE-LEVEL ONLY. You earn only from users you DIRECTLY referred — never from their referrals.
//     (referral-model.ts keeps multi-level off unless deliberately opted in; this file never cascades:
//     override points are credited straight to the direct referrer and never re-trigger an override.)
//   • Rewards are tied to REAL, advertiser-funded ACTIVITY (a completed, fraud-screened survey), not to
//     recruiting head-count — the activation bonus only pays after the referred user does real work.
//   • PLATFORM-FUNDED / minted on top. The referred user always keeps 100% of their own points; the
//     override is issued to the referrer as a subsidy (a cost) covered by the advertiser pool + breakage.
//   • Points are non-cashable closed-loop credit. Nothing here converts points to cash.

import { db } from "./db.ts";
import { adjustUserBalance } from "./balance.ts";
import { snapNumber, snapBool } from "./settings.ts";
import { pointValueUsd, recordSubsidy } from "./revenue.ts";

export const referralSignupBonusUsd = () => Math.max(0, snapNumber("REFERRAL_SIGNUP_BONUS_USD", 4));
export const referralOverridePct = () => Math.min(1, Math.max(0, snapNumber("REFERRAL_OVERRIDE_PCT", 0.10)));
export const referralOverrideEnabled = () => snapBool("REFERRAL_OVERRIDE_ENABLED", true);
export const referralBonusRequireKyc = () => snapBool("REFERRAL_BONUS_REQUIRE_KYC", false);

const usdToPoints = (usd: number) => Math.round(Math.max(0, usd) / Math.max(0.0001, pointValueUsd()));

/** Best-effort identity-KYC check across the common field names (used only when the toggle is on). */
export function kycVerifiedBestEffort(user: Record<string, unknown> | null | undefined): boolean {
  if (!user) return false;
  const s = String(user.kyc_status || "").toLowerCase();
  return s === "verified" || s === "approved" || user.kyc_verified === true || user.identity_verified === true;
}

/** The DIRECT referrer's user id for a referred user (single-level), or null. */
export async function directReferrerId(referredUserId: string): Promise<string | null> {
  if (!referredUserId) return null;
  const rows = await db.filter("Referral", { referred_user_id: referredUserId }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
  const r = (rows || [])[0];
  if (!r) return null;
  const id = (r.referrer_user_id as string) || (r.referrer_id as string) || null;
  if (!id || id === referredUserId) return null;   // no self-referral
  return id;
}

/** One-time activation bonus to the referrer once the referred user completes a first (fraud-screened)
 *  survey. Idempotent via the Referral row's `signup_bonus_paid` flag. Platform-funded. */
export async function payReferralSignupBonusOnce(base44: any, referredUserId: string): Promise<number> {
  if (!referredUserId) return 0;

  const rows = await db.filter("Referral", { referred_user_id: referredUserId }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
  const referral = (rows || [])[0];
  if (!referral) return 0;                                   // not a referred user
  if (referral.signup_bonus_paid === true) return 0;         // already paid (idempotent)

  const referrerId = (referral.referrer_user_id as string) || (referral.referrer_id as string) || "";
  if (!referrerId || referrerId === referredUserId) return 0;

  if (referralBonusRequireKyc()) {                            // gated on identity KYC (only fetch when needed)
    const u = await db.get("User", referredUserId).catch(() => null) as Record<string, unknown> | null;
    if (!kycVerifiedBestEffort(u)) return 0;
  }

  const bonusPoints = usdToPoints(referralSignupBonusUsd());

  // Atomic claim (COALESCE-safe on an absent field): only the caller that increments the counter to exactly
  // 1 wins the payout, so concurrent survey completions can't double-pay. incrementField returns null on
  // error → treated as "not won".
  const claim = await db.incrementField("Referral", String(referral.id), "signup_bonus_claim", 1).catch(() => null);
  if (claim !== 1) return 0;

  await db.update("Referral", String(referral.id), { signup_bonus_paid: true, signup_bonus_points: bonusPoints, signup_bonus_at: new Date().toISOString() }).catch(() => null);
  if (bonusPoints <= 0) return 0;

  await adjustUserBalance(referrerId, bonusPoints, { field: "points" }).catch(() => null);
  await recordSubsidy({ type: "referral_bonus", amount_usd: bonusPoints * pointValueUsd(), user_id: referrerId, ref: String(referral.id), funded_by: "advertiser_pool+breakage", meta: { referred_user_id: referredUserId, bonus_points: bonusPoints, single_level: true } }).catch(() => null);
  await base44.asServiceRole.entities.Notification.create({
    user_id: referrerId, type: "referral_bonus",
    title: "🎁 Referral bonus earned!",
    message: `Someone you referred just completed their first survey — you earned ${bonusPoints} points.`, is_read: false,
  }).catch(() => null);
  return bonusPoints;
}

/** Ongoing SINGLE-LEVEL override: when a referred user earns survey points, mint `pct` of that to their
 *  DIRECT referrer (platform-funded, referred user unaffected). Fires only while the referral is active,
 *  because it's triggered by the referral's own activity. Never cascades. */
export async function creditReferralOverrideOnEarn(base44: any, referredUserId: string, earnedPoints: number): Promise<number> {
  if (!referralOverrideEnabled()) return 0;
  const pts = Math.round(Math.max(0, Number(earnedPoints) || 0) * referralOverridePct());
  if (pts <= 0) return 0;

  const referrerId = await directReferrerId(referredUserId);
  if (!referrerId) return 0;

  await adjustUserBalance(referrerId, pts, { field: "points" }).catch(() => null);   // minted on top
  await recordSubsidy({ type: "referral_override", amount_usd: pts * pointValueUsd(), user_id: referrerId, ref: referredUserId, funded_by: "advertiser_pool+breakage", meta: { referred_user_id: referredUserId, override_points: pts, pct: referralOverridePct(), single_level: true } }).catch(() => null);
  return pts;
}
