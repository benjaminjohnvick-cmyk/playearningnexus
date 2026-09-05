import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { featurePmfEnabled, buildFeaturePmfScoreboard } from "../../sdk/feature-pmf.ts";

// featurePmfScoreboard — admin READ of the retention-weighted PMF scoreboard for the dashboard. Returns the
// latest stored snapshot when present, else computes live. Includes the per-tier "which features earn the most"
// revenue ranking the owner asked for.
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const wantLive = body?.live === true;

    if (!wantLive) {
      const rows = await base44.asServiceRole.entities.FeaturePmfSnapshot.filter({}, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
      if (rows && rows.length) {
        const s = rows[0];
        return Response.json({
          ok: true, enabled: featurePmfEnabled(), source: "snapshot",
          computed_at: s.computed_at ?? s.at, window_days: s.window_days,
          features: s.features ?? [], by_tier: s.by_tier ?? [],
        });
      }
    }
    // No snapshot yet (or a live refresh was requested) — compute on the fly.
    const board = await buildFeaturePmfScoreboard();
    return Response.json({ ok: true, enabled: featurePmfEnabled(), source: "live", ...board });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
