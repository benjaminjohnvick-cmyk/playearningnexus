// Affiliate program — flat, tier-based bounties (single-tier, performance-based; NOT MLM).
//
// An affiliate earns a ONE-TIME flat bounty each time someone THEY directly referred becomes
// "active" (the referred user reaches AFFILIATE_ACTIVATION_THRESHOLD in cumulative earnings). There
// is NO ongoing percentage and NO downline. The bounty scales with the affiliate's OWN performance
// tier — measured by their number of active referrals — so bigger producers earn bigger bounties.
// This is legitimate performance-based affiliate compensation, not multi-level marketing.
//
// Every amount/threshold is env-configurable, so you can tune the economics without a deploy.
import { round2 } from "./premium-ppc.ts";
import { snapNumber, snapString } from "./settings.ts";

// A referral is "active" (bounty-eligible) once the referred user has earned at least this much.
export const AFFILIATE_ACTIVATION_THRESHOLD = Number(Deno.env.get("AFFILIATE_ACTIVATION_THRESHOLD") ?? "8");
/** Live, admin-adjustable activation threshold (DB override → env → default). */
export function activationThreshold(): number { return snapNumber("AFFILIATE_ACTIVATION_THRESHOLD", AFFILIATE_ACTIVATION_THRESHOLD); }

export interface AffiliateTier { name: string; min_active_referrals: number; bounty: number; }

// Highest threshold first — the first tier whose minimum is met wins.
export function tiers(): AffiliateTier[] {
  const n = (k: string, d: number) => snapNumber(k, d);
  return [
    { name: "Platinum", min_active_referrals: n("AFFILIATE_TIER_PLATINUM_MIN", 50), bounty: n("AFFILIATE_BOUNTY_PLATINUM", 10) },
    { name: "Gold",     min_active_referrals: n("AFFILIATE_TIER_GOLD_MIN", 25),     bounty: n("AFFILIATE_BOUNTY_GOLD", 8) },
    { name: "Silver",   min_active_referrals: n("AFFILIATE_TIER_SILVER_MIN", 10),   bounty: n("AFFILIATE_BOUNTY_SILVER", 6) },
    { name: "Bronze",   min_active_referrals: n("AFFILIATE_TIER_BRONZE_MIN", 0),    bounty: n("AFFILIATE_BOUNTY_BRONZE", 5) },
  ];
}

export function resolveTier(activeReferrals: number): AffiliateTier {
  const c = Number(activeReferrals) || 0;
  const t = tiers().find((x) => c >= x.min_active_referrals);
  return t ?? tiers()[tiers().length - 1];
}

/** The flat bounty an affiliate earns per active referral, given their current active-referral count. */
export function bountyFor(activeReferrals: number): number {
  return round2(resolveTier(activeReferrals).bounty);
}

// --- Commission mode: ONGOING single-tier % (default) or one-time BOUNTY --------------------------
export type CommissionMode = "ongoing" | "bounty";
export function commissionMode(): CommissionMode {
  return snapString("AFFILIATE_COMMISSION_MODE", "ongoing").toLowerCase() === "bounty" ? "bounty" : "ongoing";
}

// Ongoing single-tier commission rate — a % of each referral's real activity, scaled by the
// affiliate's own tier (their active-referral count). Still single-tier (only the direct referrer),
// so it's recurring "residual" affiliate income, not MLM.
export function ongoingRateFor(activeReferrals: number): number {
  const n = (k: string, d: number) => snapNumber(k, d);
  const rates: Record<string, number> = {
    Bronze: n("AFFILIATE_ONGOING_RATE_BRONZE", 0.05),
    Silver: n("AFFILIATE_ONGOING_RATE_SILVER", 0.06),
    Gold: n("AFFILIATE_ONGOING_RATE_GOLD", 0.08),
    Platinum: n("AFFILIATE_ONGOING_RATE_PLATINUM", 0.10),
  };
  return rates[resolveTier(activeReferrals).name] ?? 0.05;
}
