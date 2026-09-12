import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { db } from "../../sdk/db.ts";
import { emitEvent } from "../../sdk/events.ts";
import { aiPaused } from "../../sdk/ai-control.ts";
import {
  computePublisherAdMetrics,
  computeAdNetworkAdvertiserMetrics,
  computeOwnAdSocialMetrics,
  adMetricsEnabled,
  adMetricsAiOptimizationEnabled,
} from "../../sdk/ad-metrics.ts";
import {
  recordAdMetricSnapshot,
  decideAdAction,
  applyAdAction,
} from "../../sdk/ad-metrics-optimizer.ts";
import { normalizeObjective, type OptimizeObjective } from "../../sdk/ad-audience.ts";

// adMetricsSweep (INTERNAL/ADMIN or scheduled) — the MEASURE → TRACK → LEARN → IMPROVE pass for the ad metric
// set. Each run: (1) computes the platform monetization metrics + each active advertiser's network metrics,
// (2) TRACKS them by writing OptimizationSignal snapshots (the history the optimizer reads back over time),
// (3) has the AI optimizer decide a reversible delivery-priority action per advertiser and route it through
// the autonomy kernel (gateAndRun "ad_optimization") — auto-applies on trust, else queues a human review;
// it NEVER raises spend and never touches billing (those stay on their permanent gates). Everything-on by
// default; respects the global AI pause and the ai-optimization flag.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    if (!adMetricsEnabled()) return Response.json({ enabled: false, reason: "ad metrics disabled" });
    const body = await req.json().catch(() => ({}));
    const windowDays = Math.max(1, Math.round(Number(body.window_days) || 7));
    const optimize = adMetricsAiOptimizationEnabled() && !(await aiPaused().catch(() => false));

    // Step 1 — platform monetization metrics + own-business AI social ads + track both.
    const publisher = await computePublisherAdMetrics(windowDays);
    await recordAdMetricSnapshot("publisher", publisher as unknown as Record<string, unknown>, windowDays);
    const ownAdSocial = await computeOwnAdSocialMetrics(windowDays);
    await recordAdMetricSnapshot("social_own", ownAdSocial as unknown as Record<string, unknown>, windowDays);

    // Step 2 — per-advertiser: metrics, track, optimize through the gate.
    const objectives = await activeAdvertiserObjectives();
    const advertisers = [...objectives.keys()];
    const results: Record<string, unknown>[] = [];
    let boosted = 0, cut = 0, varied = 0, steady = 0, queued = 0, applied = 0;
    for (const uid of advertisers) {
      const net = await computeAdNetworkAdvertiserMetrics(uid, windowDays).catch(() => null);
      if (!net) continue;
      await recordAdMetricSnapshot(`advertiser:${uid}`, net as unknown as Record<string, unknown>, windowDays);

      let action: string | null = null, gate: Record<string, unknown> | null = null;
      if (optimize) {
        const decided = decideAdAction(net, uid, objectives.get(uid));
        if (decided) {
          action = decided.action;
          if (decided.action === "boost") boosted++;
          else if (decided.action === "cut") cut++;
          else if (decided.action === "vary") varied++;
          else steady++;
          // Only spend the gate on real moves (boost/cut/vary); "steady" is a no-op nudge.
          if (decided.action !== "steady") {
            const g = await applyAdAction(decided).catch(() => null) as Record<string, unknown> | null;
            gate = g;
            if (g?.executed) applied++;
            else if (g?.pending) queued++;
          }
        }
      }
      results.push({ advertiser_id: uid, roas: net.roas, ctr_pct: net.ctr_pct, ecpm_usd: net.ecpm_usd, cpp_usd: net.cpp_usd, substantiated: net.substantiated, action, gate: gate ? { executed: gate.executed, pending: gate.pending, reason: gate.reason } : null });
    }

    await emitEvent("ad_metrics.sweep.completed", {
      window_days: windowDays, advertisers: advertisers.length,
      ecpm_usd: publisher.ecpm_usd, fill_rate_pct: publisher.fill_rate_pct,
      boosted, cut, varied, steady, applied, queued, optimized: optimize,
    }, { source: "adMetricsSweep" }).catch(() => null);

    return Response.json({
      enabled: true, window_days: windowDays, optimized: optimize,
      publisher, own_ad_social: ownAdSocial, advertisers: results,
      summary: { count: advertisers.length, boosted, cut, varied, steady, auto_applied: applied, queued_for_review: queued },
      note: "Metrics tracked as OptimizationSignal history; delivery actions routed through the autonomy kernel (ad_optimization) — reversible, no spend increase, billing untouched.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});

/** Advertisers with recent ad activity → their optimize_for objective (roas | new_users | existing_users).
 *  Owners of active AdListings (objective read from the listing) plus founding advertisers. Bounded. */
async function activeAdvertiserObjectives(): Promise<Map<string, OptimizeObjective>> {
  const map = new Map<string, OptimizeObjective>();
  try {
    const listings = (await db.filter("AdListing", { status: "active" }, "-updated_date", 1000).catch(() => [])) as Record<string, unknown>[];
    for (const a of listings) {
      const o = String(a.owner_user_id ?? "");
      if (!o) continue;
      // First listing seen for an owner sets the objective (advertisers set it per campaign; roas is the default).
      if (!map.has(o)) map.set(o, normalizeObjective(a.optimize_for));
    }
  } catch { /* */ }
  try {
    const grid = (await db.filter("AdGridAd", { status: "active" }, "-created_date", 1000).catch(() => [])) as Record<string, unknown>[];
    for (const g of grid) { const o = String(g.advertiser_user_id ?? ""); if (o && !map.has(o)) map.set(o, normalizeObjective(g.optimize_for)); }
  } catch { /* */ }
  try {
    const founding = (await db.filter("FoundingAdvertiser", {}, "-created_date", 500).catch(() => [])) as Record<string, unknown>[];
    for (const f of founding) { const o = String(f.user_id ?? ""); if (o && !map.has(o)) map.set(o, normalizeObjective(f.optimize_for)); }
  } catch { /* */ }
  return new Map([...map.entries()].slice(0, 500));
}
