// extension.ts — the browser-extension backend: attention rewards on OUR OWN inventory, affiliate cashback with
// CLEAN attribution, and the advertiser extension-inventory clause. Compliant model (see
// BROWSER-EXTENSION-ATTENTION-REWARDS-DESIGN.md): we never inject/replace other sites' ads, never override an
// existing affiliate cookie, and pay users in closed-loop, non-cashable Site Points. Master EXTENSION_ENABLED is
// counsel-gated OFF; the affiliate and browsing layers are separately gated (need a network account / counsel).
import { snapBool, snapNumber, snapString } from "./settings.ts";
import { db } from "./db.ts";

// ── Gates & posture ──────────────────────────────────────────────────────────────────────────────────────
export const extensionEnabled = () => snapBool("EXTENSION_ENABLED", false);
export const extensionOwnAdsEnabled = () => snapBool("EXTENSION_OWN_ADS_ENABLED", false);
export const extensionAffiliateEnabled = () => snapBool("EXTENSION_AFFILIATE_ENABLED", false);
export const extensionTrackingEnabled = () => snapBool("EXTENSION_TRACKING_ENABLED", false);
export const extensionRewardsDefaultEnrolled = () => snapBool("EXTENSION_REWARDS_DEFAULT_ENROLLED", true);
export const extensionTrackingRequireOptin = () => snapBool("EXTENSION_TRACKING_REQUIRE_OPTIN", true);
export const extensionAdvertiserDefaultEligible = () => snapBool("EXTENSION_ADVERTISER_DEFAULT_ELIGIBLE", true);
export const extensionInventoryClauseVersion = () => snapString("EXTENSION_INVENTORY_CLAUSE_VERSION", "v1");
export const extensionWebstoreUrl = () => snapString("EXTENSION_WEBSTORE_URL", "");

// ── Reward config ────────────────────────────────────────────────────────────────────────────────────────
export const extensionRewardPerImpressionPoints = () => Math.max(0, Math.round(snapNumber("EXTENSION_REWARD_PER_IMPRESSION_POINTS", 5)));
export const extensionAffiliateUserSharePct = () => Math.min(1, Math.max(0, snapNumber("EXTENSION_AFFILIATE_USER_SHARE_PCT", 0.5)));
export const extensionRewardDailyCapUsd = () => Math.max(0, snapNumber("EXTENSION_REWARD_DAILY_CAP_USD", 1));
export const extensionRewardLifetimeCapUsd = () => Math.max(0, snapNumber("EXTENSION_REWARD_LIFETIME_CAP_USD", 200));

export const pointsToUsd = (pts: number) => (Math.max(0, Number(pts) || 0)) / 100;
export const usdToPoints = (usd: number) => Math.round((Math.max(0, Number(usd) || 0)) * 100);
const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Ad-view reward already earned today / ever (USD) for the daily + lifetime caps. */
export async function rewardTotals(userId: string): Promise<{ todayUsd: number; lifetimeUsd: number }> {
  const day = new Date().toISOString().slice(0, 10);
  const todayPts = await db.sum("ExtensionReward", "points", { user_id: String(userId), day, kind: "own_ad" }).catch(() => 0);
  const lifePts = await db.sum("ExtensionReward", "points", { user_id: String(userId), kind: "own_ad" }).catch(() => 0);
  return { todayUsd: pointsToUsd(Number(todayPts) || 0), lifetimeUsd: pointsToUsd(Number(lifePts) || 0) };
}

/** Grantable points for one extension ad view, clamped to the remaining daily + lifetime room. */
export async function grantablePointsForOneAd(userId: string): Promise<number> {
  const per = extensionRewardPerImpressionPoints();
  if (per <= 0) return 0;
  const { todayUsd, lifetimeUsd } = await rewardTotals(userId);
  const dailyRoom = usdToPoints(Math.max(0, extensionRewardDailyCapUsd() - todayUsd));
  const lifeRoom = usdToPoints(Math.max(0, extensionRewardLifetimeCapUsd() - lifetimeUsd));
  return Math.max(0, Math.min(per, dailyRoom, lifeRoom));
}

// ── Clean attribution (the anti-"Honey-hijack" rule) ─────────────────────────────────────────────────────
/** May we attach OUR affiliate attribution for this referral? NO if another party's affiliate cookie is already
 *  present (never override), and only YES when the user genuinely engaged our link. This is the rule that keeps
 *  us out of the Honey attribution-hijacking problem. */
export function mayAttributeAffiliate(input: { existing_cookie_present?: boolean; genuine_referral?: boolean }): { allowed: boolean; reason: string } {
  if (input.existing_cookie_present) return { allowed: false, reason: "existing_affiliate_attribution_present" };
  if (!input.genuine_referral) return { allowed: false, reason: "not_a_genuine_referral" };
  return { allowed: true, reason: "ok" };
}

/** Split an affiliate commission into the user's closed-loop points share and the platform's margin. */
export function splitAffiliateCommission(commissionUsd: number): { user_points: number; platform_usd: number; user_usd: number } {
  const gross = Math.max(0, Number(commissionUsd) || 0);
  const userUsd = round2(gross * extensionAffiliateUserSharePct());
  return { user_points: usdToPoints(userUsd), user_usd: userUsd, platform_usd: round2(gross - userUsd) };
}
