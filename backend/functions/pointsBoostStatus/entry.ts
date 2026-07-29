import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { boostStatus } from "../../sdk/points-boost.ts";

// pointsBoostStatus (authenticated) — returns the live Boost ticker data: the user's personal Boost %,
// their balance, per-day growth, accrued-but-unharvested points, vault state, and lifetime cap. The
// client animates between polls to make it feel like a live, appreciating number.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const status = await boostStatus(user.id);
    return Response.json({ ok: true, ...status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
