import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  normalizeTier, creativeSuiteTierCaps, effectiveAutonomy, AD_FORMATS,
  playbookFor, playbookRecommendations, generationsRemaining, isFatigued,
} from "../../sdk/creative-suite.ts";

// aiCreativeSuiteStatus — the AI Creative Suite dashboard payload for an advertiser: their tier capabilities,
// quota, active experiments, the learned playbook (top attributes + recommendations), and any fatigued
// creatives that are due for a refresh.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const tier = normalizeTier(body?.tier ?? url.searchParams.get("tier"));
    const caps = creativeSuiteTierCaps(tier);
    const today = new Date().toISOString();

    const [used, activeExperiments, assets, playbook] = await Promise.all([
      db.count("CreativeAsset", { advertiser_id: user.id }).catch(() => 0),
      db.count("AdCreativeTest", { advertiser_id: user.id, status: "running" }).catch(() => 0),
      db.filter("CreativeAsset", { advertiser_id: user.id, status: "live" }, "-created_at", 200).catch(() => []) as Promise<Record<string, unknown>[]>,
      playbookFor(db, user.id, today).catch(() => null),
    ]);

    // Fatigue scan over live creatives (uses tracked impressions/CTR).
    const fatigued: Record<string, unknown>[] = [];
    for (const a of assets || []) {
      const impressions = Number(a.impressions) || 0;
      const clicks = Number(a.clicks) || 0;
      const ctrBaseline = Number(a.ctr_baseline) || (impressions > 0 ? clicks / impressions : 0);
      const ctrRecent = Number(a.ctr_recent) || ctrBaseline;
      const ageDays = a.created_at ? Math.max(0, (Date.parse(today) - Date.parse(String(a.created_at))) / 86400000) : 0;
      const f = isFatigued({ impressions, ctr_recent: ctrRecent, ctr_baseline: ctrBaseline, age_days: ageDays });
      if (f.fatigued) fatigued.push({ id: a.id, format: a.format, headline: a.headline, reason: f.reason });
    }

    const remaining = generationsRemaining(tier, used);
    return Response.json({
      tier,
      enabled: caps.enabled,
      capabilities: {
        ...caps,
        effective_autonomy: effectiveAutonomy(tier, caps.autonomy_ceiling),
        formats_detail: AD_FORMATS.filter((f) => caps.formats.includes(f.key)).map((f) => ({ key: f.key, label: f.label, medium: f.medium })),
      },
      quota: { cap: caps.monthly_generations, used, remaining: Number.isFinite(remaining) ? remaining : "unlimited" },
      experiments: { active: activeExperiments, max_concurrent: caps.max_concurrent_experiments || "unlimited", multivariate: caps.multivariate },
      learning: {
        depth: caps.learning_depth,
        sample_size: playbook?.sample_size ?? 0,
        top_attributes: playbook?.top ?? {},
        recommendations: playbook ? playbookRecommendations(playbook) : [],
      },
      fatigue: { auto_refresh: caps.auto_refresh, due: fatigued },
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
