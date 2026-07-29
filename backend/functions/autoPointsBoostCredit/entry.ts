import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { getBool } from "../../sdk/settings.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { harvestBoost } from "../../sdk/points-boost.ts";

// autoPointsBoostCredit (INTERNAL/ADMIN, scheduled daily) — the "daily harvest" job. It auto-credits
// each active user's accrued Boost growth so their points visibly grow even without a manual harvest.
// Bounded per-user by the engine's daily + lifetime caps (breakage-funded, ~$0). Only touches users
// with a positive balance to keep the batch small.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    if (!(await isEnabled("points_boost").catch(() => true))) return Response.json({ success: true, skipped: "points_boost off" });
    if (!(await getBool("BOOST_AUTO_CREDIT", true).catch(() => true))) return Response.json({ success: true, skipped: "auto-credit off" });

    // Users with a balance to grow. Bounded batch; the job runs daily so it catches everyone over time.
    const users = await db.filter("User", {}, "-current_balance", 2000).catch(() => []) as any[];
    let credited = 0, totalPoints = 0;
    for (const u of users) {
      if ((Number(u.current_balance) || 0) <= 0) continue;
      const r = await harvestBoost(u.id).catch(() => ({ credited_points: 0 }));
      if (r.credited_points > 0) { credited++; totalPoints += r.credited_points; }
    }
    return Response.json({ success: true, users_credited: credited, total_points: totalPoints });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
