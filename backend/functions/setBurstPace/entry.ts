import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { normalizePace } from "../../sdk/burst.ts";

// setBurstPace (authenticated) — the user picks their pace: "survey" (one survey at a time), "timed" (a
// 60-second sprint), or "count" (a set number of units). Stored on the day's BurstSession. Upsert.
//   Body: { pace }  → { success, pace }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const pace = normalizePace(body.pace);
    const today = new Date().toISOString().slice(0, 10);

    const bsRows = await db.filter("BurstSession", { user_id: user.id, day: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    if (bsRows?.[0]) {
      await db.update("BurstSession", bsRows[0].id as string, { pace }).catch(() => null);
    } else {
      await base44.asServiceRole.entities.BurstSession.create({ user_id: user.id, day: today, bursts_completed: 0, pace }).catch(() => null);
    }
    return Response.json({ success: true, pace });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
