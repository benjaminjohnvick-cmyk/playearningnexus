import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { computeAdvertiserMetrics } from "../../sdk/advertiser-metrics.ts";
import { progressionEnabled, progressionDecision, progressionNoticeDays, normalizeTier } from "../../sdk/tier-progression.ts";
import { foundingImpressionsPerYear } from "../../sdk/founding-advertiser.ts";

// advertiserProgressionStatus — the "see your results → Agree" screen. Returns the advertiser's MEASURED
// results and whether they're at a term boundary with an option to renew (same tier), auto-advance (if opted
// in and the measured ROI threshold is met), or complete (year caps reached).
const YEAR_MS = 365.25 * 24 * 3600 * 1000;

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!progressionEnabled()) return Response.json({ error: "Tier progression is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const advertiserId = (user.role === "admin" && body.advertiser_id) ? String(body.advertiser_id) : user.id;

    const rows = await db.filter("FoundingAdvertiser", { user_id: advertiserId }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = rows[0];
    if (!rec) return Response.json({ error: "No advertiser record found.", enrolled: false }, { status: 404 });

    const metrics = await computeAdvertiserMetrics(advertiserId, Math.max(30, Number(body.window_days) || 90)).catch(() => null);
    const perYear = Math.max(1, foundingImpressionsPerYear());
    const served = Math.max(0, Number(rec.impressions_served) || 0);
    const deliveredPct = Math.min(1, served / perYear);

    const today = new Date().toISOString();
    const startISO = String(rec.tier_started_at ?? rec.purchased_at ?? rec.created_date ?? today);
    const start = Date.parse(startISO);
    const anniversary = isNaN(start) ? Date.parse(today) : start + YEAR_MS;
    const noticeMs = progressionNoticeDays() * 24 * 3600 * 1000;
    const atTermBoundary = Date.parse(today) >= (anniversary - noticeMs);

    const mIn = {
      roas: Number(metrics?.roas_incl_social ?? metrics?.roas) || 0,
      roi_pct: Number(metrics?.roi_pct) || 0,
      delivered_pct: deliveredPct,
      substantiated: !!metrics?.substantiated,
    };
    const decision = progressionDecision(rec, mIn, today, atTermBoundary);

    return Response.json({
      success: true, advertiser_id: advertiserId, tier: normalizeTier(rec.current_tier ?? rec.tier),
      auto_advance_opt_in: rec.auto_advance_opt_in === true,
      auto_advance_roas: Number(rec.auto_advance_roas) || null,
      term_ends: new Date(anniversary).toISOString(),
      decision,
      results_summary: metrics
        ? (mIn.substantiated
            ? `Measured over the window: ROAS ${mIn.roas.toFixed(2)}, ROI ${mIn.roi_pct.toFixed(0)}%, ${Math.round(deliveredPct * 100)}% of your advertising delivered. ${decision.results.going_well ? "Results are on track." : "Below the renewal baseline — shown honestly."}`
            : "Still gathering enough data to substantiate your results — nothing is guaranteed.")
        : "Results unavailable.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
