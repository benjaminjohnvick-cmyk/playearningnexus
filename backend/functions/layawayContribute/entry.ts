import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { contributeLayaway } from "../../sdk/layaway.ts";
import { recordMetricForUser } from "../../sdk/live-experiments.ts";

// layawayContribute (authenticated) — apply earned points toward an open layaway. When fully paid, the
// item is released to fulfillment (ship or local pickup) and any welcome credit is redeemed.
// Body: { layaway_id, points }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { layaway_id, points } = await req.json().catch(() => ({}));
    if (!layaway_id) return Response.json({ error: "layaway_id required" }, { status: 400 });
    const r = await contributeLayaway(user.id, layaway_id, Number(points));
    if ((r as any).error) return Response.json(r, { status: 400 });
    if ((r as any).completed) recordMetricForUser(user.id, "layaway_complete", 1).catch(() => {});
    return Response.json(r);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
