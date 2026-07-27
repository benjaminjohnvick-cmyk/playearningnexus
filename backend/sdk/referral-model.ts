// Referral compensation model — AFFILIATE vs MLM.
//
// The platform runs an AFFILIATE model by DEFAULT: single-tier, performance-based commissions paid
// only to the person who DIRECTLY referred a user, tied to that user's real revenue-generating
// activity. There are NO downline / upline levels and NO pay for recruiting itself — which is what
// keeps the program clear of pyramid / chain-referral law.
//
// Multi-level (MLM) payouts require BOTH of these, so they can never turn on by accident:
//   1) REFERRAL_MODEL=mlm   (env — deliberate opt-in), AND
//   2) the multi_level_referrals feature flag ON.
// In affiliate mode the flag is ignored entirely.
import { isEnabled } from "./feature-flags.ts";
import { snapString } from "./settings.ts";

export type ReferralModel = "affiliate" | "mlm";

export function referralModel(): ReferralModel {
  return snapString("REFERRAL_MODEL", "affiliate").toLowerCase() === "mlm" ? "mlm" : "affiliate";
}

export function isAffiliateOnly(): boolean {
  return referralModel() === "affiliate";
}

/** True only if multi-level payouts are BOTH model-enabled AND flag-enabled. Default: false. */
export async function multiLevelAllowed(): Promise<boolean> {
  if (referralModel() !== "mlm") return false; // affiliate mode → always single-tier
  return await isEnabled("multi_level_referrals");
}
