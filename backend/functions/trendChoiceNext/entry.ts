import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { snapBool, snapNumber } from "../../sdk/settings.ts";
import { usableTrends, type TrendSignal } from "../../sdk/video-engine.ts";
import { fairChoiceSet, displayOrder } from "../../sdk/fair-choice.ts";

// trendChoiceNext — show the user a FAIR set of current-event topics to pick from. Options are drawn uniformly
// (no ranking, no momentum ordering) and their display order is randomized, so no option is favored. Every
// shown option is logged as an impression, so results can be scored as exposure-normalized pick-rate. The
// user's pick becomes preference data automatically — no survey question. Any signed-in user.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!snapBool("FAIR_CHOICE_ENABLED", true)) return Response.json({ done: true, reason: "fair choice disabled" });

    const size = Math.max(2, Math.min(6, Math.round(snapNumber("FAIR_CHOICE_SET_SIZE", 4))));
    const rows = await db.filter("VideoTrend", {}, "-created_at", 80).catch(() => []) as Record<string, unknown>[];
    const trends: TrendSignal[] = rows.map((r) => ({ topic: String(r.topic ?? ""), momentum: Number(r.momentum) || 0, hashtags: Array.isArray(r.hashtags) ? r.hashtags as string[] : [], category: String(r.category ?? "") }));
    const pool = usableTrends(trends).map((t) => t.topic);
    if (pool.length < 2) return Response.json({ done: true, reason: "not enough live topics yet" });

    // Fair draw (uniform) + randomized position. Per-user, per-minute seed so a user sees fresh sets.
    const seed = `${user.id}:${new Date().toISOString().slice(0, 16)}`;
    const chosen = displayOrder(fairChoiceSet(pool, size, seed), `${seed}:pos`);

    // Log an impression for each shown topic (exposure tracking → fair, normalized scoring later).
    const now = new Date().toISOString();
    for (const topic of chosen) {
      await db.create("TrendChoiceEvent", { topic, kind: "impression", user_id: user.id, at: now, created_at: now }).catch(() => null);
    }

    // Return uniform options — NO momentum, NO ordering signal, so the UI can render them identically.
    const byTopic = new Map(trends.map((t) => [t.topic, t]));
    const options = chosen.map((topic) => ({ topic, hashtags: byTopic.get(topic)?.hashtags ?? [] }));
    return Response.json({ done: false, prompt: "Which of these are you most interested in right now?", options, fair: true });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
