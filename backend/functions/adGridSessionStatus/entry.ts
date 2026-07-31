import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { sessionGrossTarget, adgridThumbnailsPerSession } from "../../sdk/adgrid.ts";

// adGridSessionStatus (authenticated) — today's AdGrid session progress (thumbnails done, gross, complete?).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const day = new Date().toISOString().slice(0, 10);
    const rows = await db.filter("AdGridSession", { user_id: user.id, day }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const s = (rows || [])[0] || {};
    const target = sessionGrossTarget();
    const grossUsd = Math.round((Number(s.gross_usd) || 0) * 100) / 100;

    return Response.json({
      day,
      thumbnails_done: Number(s.thumbnails_done) || 0,
      thumbnails_per_session: adgridThumbnailsPerSession(),
      gross_usd: grossUsd,
      goal_usd: target,
      complete: grossUsd >= target,
      remaining_usd: Math.max(0, Math.round((target - grossUsd) * 100) / 100),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
