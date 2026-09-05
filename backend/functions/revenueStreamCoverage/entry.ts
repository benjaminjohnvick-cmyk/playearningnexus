import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { revenueCoverageEnabled, buildRevenueCoverage } from "../../sdk/revenue-coverage.ts";
import { snapNumber } from "../../sdk/settings.ts";

// revenueStreamCoverage — admin READ of the COMPLETE revenue-stream coverage map: every one of the ~45 revenue
// sub-points across all 8 categories, each with its real revenue, status, live/pending, and whether it's a
// tiered advertiser feature. Guarantees no stream is invisible — the companion to the retention-weighted PMF
// scoreboard (which ranks the advertiser subset).
export default __handler(async (req) => {
  const gate = await requireInternalOrAdmin(req);
  if (gate) return gate;
  try {
    if (!revenueCoverageEnabled()) return Response.json({ ok: true, enabled: false, note: "Revenue coverage is OFF." });
    const body = await req.json().catch(() => ({}));
    const windowDays = Math.max(2, Number(body.window_days) || snapNumber("PMF_WINDOW_DAYS", 30));
    const coverage = await buildRevenueCoverage(windowDays);
    return Response.json({ ok: true, enabled: true, ...coverage });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
