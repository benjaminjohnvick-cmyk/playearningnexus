import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { newChoiceAcc, addChoice, rankChoiceAcc, exposureBalance } from "../../sdk/fair-choice.ts";

// trendChoiceResults — the unbiased ranking of current-event topics by EXPOSURE-NORMALIZED pick-rate (picks ÷
// times-shown), so an option shown more can never win on exposure. Includes a fairness diagnostic (how equal
// exposure was). Optionally (apply:true) nudges the winning topics' momentum up in the live trend pool, so the
// content engine automatically leans into what users actually chose. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    // Stream ALL choice events in bounded memory (keyset scan): the per-topic accumulator is bounded by the
    // number of distinct topics, so this is correct at any table size — no 20k cap silently truncating the tally.
    const acc = newChoiceAcc();
    let totalEvents = 0;
    for await (const batch of db.scan("TrendChoiceEvent", {}, 2000)) {
      for (const r of batch) {
        addChoice(acc, { topic: String(r.topic ?? ""), kind: (r.kind === "pick" ? "pick" : "impression") });
        totalEvents++;
      }
    }
    const tally = rankChoiceAcc(acc);
    const balance = exposureBalance(tally);

    let applied = 0;
    if (body.apply === true && tally.length) {
      // Nudge momentum of clearly-preferred topics (pick_rate high, enough exposure) up in the trend pool.
      const now = new Date().toISOString();
      for (const t of tally.filter((x) => x.impressions >= 5 && x.pick_rate >= 0.5).slice(0, 20)) {
        const trend = ((await db.filter("VideoTrend", { topic: t.topic }, "-created_at", 1).catch(() => [])) as Record<string, unknown>[])[0];
        if (!trend) continue;
        const boosted = Math.min(100, Math.round((Number(trend.momentum) || 50) + t.pick_rate * 15));
        await db.update("VideoTrend", String(trend.id), { momentum: boosted, choice_pick_rate: t.pick_rate, updated_at: now }).catch(() => null);
        applied++;
      }
    }

    return Response.json({
      ok: true, total_events: totalEvents, ranked: tally.slice(0, 40),
      fairness: { exposure_skew: balance.skew, note: "pick_rate is exposure-normalized (picks ÷ shown); skew near 1 means equal exposure too." },
      applied,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
