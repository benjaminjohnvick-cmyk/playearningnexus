import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { verifyJwt } from "../../sdk/auth.ts";
import { featurePmfEnabled, buildFeaturePmfScoreboard } from "../../sdk/feature-pmf.ts";

// featurePmfScoreboardRun — recomputes the retention-weighted Feature PMF scoreboard and stores a snapshot.
// Wired to the scheduler to run continuously (PMF discovery keeps going after launch). Authorized for an admin
// (dashboard "recompute now") OR the scheduler's server-signed service token (same pattern as the scaling
// governor: auth.me() throws when the seed-admin user row is absent, so we accept a valid signed token +
// the scheduled marker instead of 500ing).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const user = await base44.auth.me().catch(() => null);
    let authorized = user?.role === "admin";
    if (!authorized && body?.scheduled === true) {
      const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
      const payload = bearer ? await verifyJwt(bearer).catch(() => null) : null;
      if (payload) authorized = true;
    }
    if (!authorized) return Response.json({ error: "Forbidden (admin or scheduler only)." }, { status: 403 });

    if (!featurePmfEnabled()) {
      return Response.json({ ok: true, enabled: false, note: "Feature PMF scoreboard is OFF (FEATURE_PMF_ENABLED). No snapshot written." });
    }

    const board = await buildFeaturePmfScoreboard();
    // Persist ONE latest snapshot (keep it small: store the ranked arrays as JSON).
    let snapshotId: string | null = null;
    try {
      const row = await db.create("FeaturePmfSnapshot", {
        computed_at: board.computed_at,
        window_days: board.window_days,
        feature_count: board.features.length,
        features: board.features,
        by_tier: board.by_tier,
        at: board.computed_at,
      });
      snapshotId = (row as Record<string, unknown>)?.id as string ?? null;
    } catch { /* persistence best-effort */ }

    const top = board.features.slice(0, 5).map((f) => ({ rank: f.rank, key: f.key, name: f.name, pmf_score: f.pmf_score, retention_lift: f.retention_lift, revenue_usd: f.revenue_usd }));
    return Response.json({
      ok: true, enabled: true, snapshot_id: snapshotId, window_days: board.window_days,
      feature_count: board.features.length, top_features: top,
      tier_revenue: board.by_tier.map((t) => ({ tier: t.tier, tier_revenue_usd: t.tier_revenue_usd, top_by_revenue: t.top_by_revenue.slice(0, 3) })),
      note: "Retention-weighted PMF scoreboard recomputed. Runs continuously so PMF discovery persists after launch.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
