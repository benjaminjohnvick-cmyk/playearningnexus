import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import {
  computeAdNetworkAdvertiserMetrics,
  computePublisherAdMetrics,
  computeAudienceBreakdown,
  AD_METRIC_DEFINITIONS,
  adMetricsEnabled,
} from "../../sdk/ad-metrics.ts";
import { benchmarkComparison, ppcBenchmarks } from "../../sdk/advertiser-metrics.ts";
import { adMetricLearning } from "../../sdk/ad-metrics-optimizer.ts";
import { AUDIENCE_TYPES, DEMOGRAPHIC_FIELDS, OPTIMIZE_OBJECTIVES } from "../../sdk/ad-audience.ts";

// adMetricsReport (auth) — the full advertising metric set, network-standard (AppLovin-style), measured from
// real activity. Two scopes:
//   • scope:"advertiser" (default) — the caller's own metrics: impressions, clicks, CTR, CPC, conversions,
//     CVR, IPM, CPA, CPP, CPM, revenue, ROAS + the windowed D1..D365 ad_ROAS curve + benchmark comparison.
//   • scope:"publisher" — platform monetization view (eCPM, fill rate, ARPDAU, DAU, retention). ADMIN/internal
//     only. Also returns the metric dictionary (what each metric is) and recent AI-tracked trends.
// Measures, never guarantees — below the data threshold it says "still gathering data".
export default __handler(async (req) => {
  try {
    if (!adMetricsEnabled()) return Response.json({ enabled: false, reason: "ad metrics disabled" });
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const scope = String(body.scope || "advertiser");
    const windowDays = Math.max(1, Math.round(Number(body.window_days) || 7));

    if (scope === "publisher") {
      const denied = await requireInternalOrAdmin(req);
      if (denied) return denied;
      const publisher = await computePublisherAdMetrics(windowDays);
      const learning = await adMetricLearning(30, "publisher");
      return Response.json({
        enabled: true, scope, window_days: windowDays,
        publisher, trends: learning.trends,
        definitions: AD_METRIC_DEFINITIONS,
        disclaimer: "Monetization figures are measured from real ad serving and shown with their basis.",
      });
    }

    // Advertiser scope — the caller's own metrics (admins may pass advertiser_id).
    let uid = String(user.id);
    if (body.advertiser_id && user.role === "admin") uid = String(body.advertiser_id);
    const metrics = await computeAdNetworkAdvertiserMetrics(uid, windowDays);
    const comparison = benchmarkComparison(metrics);
    const learning = await adMetricLearning(30, `advertiser:${uid}`);
    const audience = await computeAudienceBreakdown(uid, Math.max(windowDays, 30));
    return Response.json({
      enabled: true, scope: "advertiser", advertiser_id: uid, window_days: windowDays,
      metrics, benchmarks: ppcBenchmarks(), comparison, trends: learning.trends,
      audience_breakdown: audience,
      targeting_options: {
        demographics: DEMOGRAPHIC_FIELDS,
        audience_types: AUDIENCE_TYPES,
        optimize_for: OPTIMIZE_OBJECTIVES,
        note: "Attach `targeting: { demographics: { age_range/gender/country/region: [...] }, audience_type: 'new'|'existing'|'all' }` to a creative, and set `optimize_for` to steer AI delivery.",
      },
      definitions: AD_METRIC_DEFINITIONS,
      disclaimer: "Performance figures are measured from your real activity and shown with their basis. " +
        "Benchmarks are industry context, not a promise — we do not guarantee any ROI.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
