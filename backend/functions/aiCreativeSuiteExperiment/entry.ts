import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { normalizeTier, creativeSuiteTierCaps } from "../../sdk/creative-suite.ts";

// aiCreativeSuiteExperiment — launch an A/B (or, for eligible tiers, multivariate) test from generated
// CreativeAsset variants. Tier-gates concurrency and multivariate. Creates an AdCreativeTest row linking the
// assets with an even traffic split; the existing autoABTestWinner / trackABTestMetrics loop then measures it,
// and aiCreativeSuiteLearn feeds the result back into the playbook.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tier = normalizeTier(body.tier);
    const caps = creativeSuiteTierCaps(tier);
    if (!caps.enabled) return Response.json({ error: "The AI Creative Suite is currently disabled." }, { status: 403 });

    const assetIds: string[] = Array.isArray(body.asset_ids) ? body.asset_ids.map(String) : [];
    if (assetIds.length < 2) return Response.json({ error: "Need at least 2 creatives to run a test." }, { status: 400 });

    const type = body.type === "multivariate" ? "multivariate" : "ab";
    if (type === "multivariate" && !caps.multivariate) {
      return Response.json({ error: "Multivariate testing isn't available on this tier — use a 2-way A/B test, or upgrade.", tier }, { status: 403 });
    }
    if (type === "ab" && assetIds.length > 2) {
      return Response.json({ error: "An A/B test takes exactly 2 creatives; use type=multivariate for more.", count: assetIds.length }, { status: 400 });
    }

    // Concurrency gate.
    if (caps.max_concurrent_experiments > 0) {
      const running = await db.count("AdCreativeTest", { advertiser_id: user.id, status: "running" }).catch(() => 0);
      if (running >= caps.max_concurrent_experiments) {
        return Response.json({ error: `You already have ${running} tests running (max ${caps.max_concurrent_experiments} on this tier). Conclude one first.`, tier }, { status: 429 });
      }
    }

    // Load + validate the assets belong to this advertiser and are compliant.
    const assets = await Promise.all(assetIds.map((id) => db.get("CreativeAsset", id).catch(() => null)));
    const valid = assets.filter((a): a is Record<string, unknown> => !!a && a.advertiser_id === user.id && a.compliant !== false);
    if (valid.length < 2) return Response.json({ error: "Could not find 2 eligible (owned, compliant) creatives to test." }, { status: 400 });

    const split = Math.floor(100 / valid.length);
    const arms = valid.map((a, i) => ({
      asset_id: a.id, label: `Variant ${String.fromCharCode(65 + i)}`,
      format: a.format, headline: a.headline, attributes: a.attributes,
      traffic_pct: i === valid.length - 1 ? 100 - split * (valid.length - 1) : split,
      impressions: 0, clicks: 0, conversions: 0,
    }));

    const test = await db.create("AdCreativeTest", {
      advertiser_id: user.id, tier, type,
      test_name: String(body.test_name ?? "Creative test").slice(0, 120),
      objective: String(body.objective ?? "ctr"),
      status: "running",
      arms,
      min_impressions_per_arm: Math.max(200, Number(body.min_impressions_per_arm) || 1000),
      started_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    }).catch((e) => { throw e; });

    // Flip the tested assets to "live" so they can accrue impressions.
    for (const a of valid) await db.update("CreativeAsset", a.id as string, { status: "live", test_id: (test as Record<string, unknown>).id }).catch(() => null);

    return Response.json({ success: true, test, arms: arms.length, type });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
