import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { harvestBoost, boostStatus } from "../../sdk/points-boost.ts";
import { recordMetricForUser } from "../../sdk/live-experiments.ts";

// pointsBoostHarvest (authenticated) — the user "harvests" their accrued growth into spendable,
// closed-loop, non-cashable points. Bounded by the daily + lifetime caps in the engine. Records a
// live-experiment metric so the self-tuning layer can measure whether the Boost drives engagement.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const res = await harvestBoost(user.id);
    if (res.credited_points > 0) recordMetricForUser(user.id, "boost_harvest", 1).catch(() => {});
    const status = await boostStatus(user.id);
    return Response.json({
      ok: true,
      credited_points: res.credited_points,
      message: res.credited_points > 0 ? `Harvested +${res.credited_points} points!` : "Keep holding — your Boost is still growing.",
      ...status,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
