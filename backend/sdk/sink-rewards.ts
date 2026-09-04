// sink-rewards.ts — the self-perpetuating sink loop. When a user makes a closed-loop Site-Cash SINK purchase
// (a cosmetic, or an earn boost), two things happen, both 100% on-site and non-cashable:
//   1) STACKING BOOST — their earn-boost multiplier is raised a step (capped), and only holds while they keep
//      buying (see bumpEarnBoostOnPurchase in boosts.ts). This keeps Site Cash draining.
//   2) LOYALTY TOP-OFF — a regular user gets SITE_CASH_TOPOFF_PCT of the purchase back as PROMOTIONAL Site Cash
//      (tagged/logged so it's excluded from any future cash-out), so they always have some to spend. Bounded by
//      a daily and a lifetime cap (cost governors) and tracked as a platform-funded SUBSIDY (a cost), never
//      revenue. Nothing here moves real money or leaves the closed loop.
import { snapBool, snapNumber } from "./settings.ts";
import { db } from "./db.ts";
import { adjustUserBalance } from "./balance.ts";
import { recordSubsidy } from "./revenue.ts";
import { bumpEarnBoostOnPurchase } from "./boosts.ts";

export const topoffEnabled = () => snapBool("SITE_CASH_TOPOFF_ENABLED", true);
export const topoffPct = () => Math.min(0.5, Math.max(0, snapNumber("SITE_CASH_TOPOFF_PCT", 0.10)));
export const topoffRegularMinDays = () => Math.max(0, Math.round(snapNumber("SITE_CASH_TOPOFF_REGULAR_MIN_DAYS", 3)));
export const topoffDailyCapUsd = () => Math.max(0, snapNumber("SITE_CASH_TOPOFF_DAILY_CAP_USD", 1));
export const topoffLifetimeCapUsd = () => Math.max(0, snapNumber("SITE_CASH_TOPOFF_LIFETIME_CAP_USD", 50));

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** A user is "regular" if they have activity on at least N distinct days (counted from DailyEarnings rows). */
export async function isRegularUser(userId: string): Promise<boolean> {
  const need = topoffRegularMinDays();
  if (need <= 0) return true;
  const days = await db.count("DailyEarnings", { user_id: String(userId) }).catch(() => 0);
  return Number(days) >= need;
}

/** Promotional top-off already granted to this user today (for the daily cap) and ever (for the lifetime cap). */
async function topoffTotals(userId: string): Promise<{ today: number; lifetime: number }> {
  const day = new Date().toISOString().slice(0, 10);
  const today = await db.sum("SiteCashTopoff", "amount_usd", { user_id: String(userId), day }).catch(() => 0);
  const lifetime = await db.sum("SiteCashTopoff", "amount_usd", { user_id: String(userId) }).catch(() => 0);
  return { today: Number(today) || 0, lifetime: Number(lifetime) || 0 };
}

export interface SinkRewardResult {
  boost_multiplier: number;         // the user's boost multiplier after this purchase
  topoff_usd: number;               // promotional Site Cash granted (0 if none)
  topoff_capped: boolean;           // true if a cap clamped the top-off
}

/** Apply the sink-purchase rewards for a purchase of `purchaseUsd`. Bumps the stacking boost and, for a regular
 *  user, grants the capped promotional top-off. Best-effort and non-throwing — a reward failure never blocks the
 *  purchase that already succeeded. */
export async function applySinkReward(userId: string, purchaseUsd: number, ref: string): Promise<SinkRewardResult> {
  const uid = String(userId);
  const spent = Math.max(0, Number(purchaseUsd) || 0);

  // 1) Stacking boost (respects its own enable flag internally).
  const boost_multiplier = await bumpEarnBoostOnPurchase(uid).catch(() => 1);

  // 2) Loyalty top-off — regular users only, bounded by daily + lifetime caps.
  let topoff_usd = 0;
  let topoff_capped = false;
  if (topoffEnabled() && spent > 0 && topoffPct() > 0) {
    if (await isRegularUser(uid).catch(() => false)) {
      let grant = round2(spent * topoffPct());
      const { today, lifetime } = await topoffTotals(uid);
      const dailyRoom = Math.max(0, topoffDailyCapUsd() - today);
      const lifeRoom = Math.max(0, topoffLifetimeCapUsd() - lifetime);
      const room = round2(Math.min(dailyRoom, lifeRoom));
      if (grant > room) { grant = room; topoff_capped = true; }
      if (grant > 0) {
        const credited = await adjustUserBalance(uid, grant, { field: "points" }).catch(() => null);
        if (credited !== null) {
          topoff_usd = grant;
          // Log for the caps + audit trail, and mark it PROMOTIONAL so a future cash-out can exclude it.
          await db.create("SiteCashTopoff", {
            user_id: uid, amount_usd: grant, purchase_usd: spent, pct: topoffPct(),
            day: new Date().toISOString().slice(0, 10), ref, promotional: true, at: new Date().toISOString(),
          }).catch(() => null);
          // Track as a platform-funded subsidy (a COST against breakage + the pool), never revenue.
          await recordSubsidy({ type: "earnback_subsidy", amount_usd: grant, user_id: uid, ref, funded_by: "breakage+pool", meta: { source: "sink_topoff", purchase_usd: spent } }).catch(() => null);
        }
      }
    }
  }

  return { boost_multiplier: Number(boost_multiplier) || 1, topoff_usd, topoff_capped };
}
