import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  normalizeTier, creativeSuiteTierCaps, effectiveAutonomy,
  recordCreativeOutcome, playbookFor, playbookRecommendations,
} from "../../sdk/creative-suite.ts";

// aiCreativeSuiteLearn — the self-learning / self-improving step. Reads the advertiser's creative tests, turns
// each arm's real performance into signed learning signals (recordCreativeOutcome → OptimizationSignal +
// AgentLearningMemory), rebuilds the playbook, and returns recommendations + the next-generation attribute
// guidance the generator should favor. In "auto" autonomy (tier-gated AND under the global cap) it also
// concludes tests that have enough data: promoting the winner and pausing the losers.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const tier = normalizeTier(body.tier);
    const caps = creativeSuiteTierCaps(tier);
    if (!caps.enabled) return Response.json({ error: "The AI Creative Suite is currently disabled." }, { status: 403 });

    const isAdmin = user.role === "admin";
    const advertiserId = (isAdmin && body.advertiser_id) ? String(body.advertiser_id) : user.id;
    const autonomy = effectiveAutonomy(tier, body.autonomy ?? caps.autonomy_ceiling);
    const today = new Date().toISOString();

    // Which tests to process.
    const q: Record<string, unknown> = { advertiser_id: advertiserId, status: "running" };
    const tests = body.test_id
      ? [await db.get("AdCreativeTest", String(body.test_id)).catch(() => null)].filter(Boolean) as Record<string, unknown>[]
      : await db.filter("AdCreativeTest", q, "-started_at", 100).catch(() => []) as Record<string, unknown>[];

    let signals = 0, concluded = 0;
    for (const t of tests) {
      const arms = Array.isArray(t.arms) ? t.arms as Record<string, unknown>[] : [];
      if (arms.length < 2) continue;
      const minImpr = Number(t.min_impressions_per_arm) || 1000;
      const ready = arms.every((a) => (Number(a.impressions) || 0) >= minImpr);

      // Per-arm CTR and the mean, to make a signed, relative performance signal.
      const ctr = (a: Record<string, unknown>) => { const i = Number(a.impressions) || 0; return i > 0 ? (Number(a.clicks) || 0) / i : 0; };
      const ctrs = arms.map(ctr);
      const mean = ctrs.reduce((s, x) => s + x, 0) / (ctrs.length || 1);
      let bestIdx = 0; for (let i = 1; i < arms.length; i++) if (ctrs[i] > ctrs[bestIdx]) bestIdx = i;

      for (let i = 0; i < arms.length; i++) {
        const a = arms[i];
        // Signed weight: how far this arm's CTR is from the mean, scaled; positive for winners.
        const rel = mean > 0 ? (ctrs[i] - mean) / mean : 0;
        const weight = Math.max(-3, Math.min(3, Math.round(rel * 3 * 100) / 100));
        await recordCreativeOutcome(db, {
          creative_id: String(a.asset_id ?? ""), advertiser_id: advertiserId, tier,
          format: String(a.format ?? "any"),
          attributes: (a.attributes as Record<string, string>) || {},
          weight, impressions: Number(a.impressions) || 0,
          outcome: i === bestIdx ? "won" : "lost", todayISO: today,
        });
        signals++;
      }

      // Auto mode: once a test has enough data, conclude it — promote winner, pause losers.
      if (autonomy === "auto" && ready) {
        await db.update("AdCreativeTest", t.id as string, {
          status: "concluded", winner_asset_id: arms[bestIdx].asset_id, concluded_at: today,
        }).catch(() => null);
        for (let i = 0; i < arms.length; i++) {
          await db.update("CreativeAsset", String(arms[i].asset_id ?? ""), {
            status: i === bestIdx ? "winner" : "paused",
          }).catch(() => null);
        }
        concluded++;
      }
    }

    const playbook = await playbookFor(db, advertiserId, today).catch(() => null);
    return Response.json({
      success: true, tier, advertiser_id: advertiserId,
      autonomy, tests_processed: tests.length, signals_recorded: signals, tests_concluded: concluded,
      playbook: playbook ? {
        sample_size: playbook.sample_size,
        next_generation_attributes: playbook.top,          // feed these back into aiCreativeSuiteGenerate
        recommendations: playbookRecommendations(playbook),
      } : null,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
