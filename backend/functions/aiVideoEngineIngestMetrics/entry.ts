import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  videoEngineEnabled, videoPerformance, scoreVideoOutcome, recordVideoOutcome,
  type VideoMetrics, type VideoConcept,
} from "../../sdk/video-engine.ts";

// aiVideoEngineIngestMetrics — feed a rendered/tested video's REAL, quantifiable metrics back in. Computes the
// video's blended performance, scores it relative to its batch mean, records a signed learning signal (so the
// playbook promotes/demotes its dimension values), and updates the VideoConcept row. This is the "measure →
// learn" half of the loop. Accepts one concept's metrics, or a batch of them. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    if (!videoEngineEnabled()) return Response.json({ error: "The AI Video Engine is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();

    // Normalize input to a list of { concept_id, metrics }.
    const items: { concept_id: string; metrics: VideoMetrics }[] =
      Array.isArray(body.items) ? body.items
        : (body.concept_id ? [{ concept_id: String(body.concept_id), metrics: (body.metrics || {}) as VideoMetrics }] : []);
    if (!items.length) return Response.json({ error: "Provide { concept_id, metrics } or { items: [...] }." }, { status: 400 });

    // Batch mean = mean blended performance across the provided items (so each is judged vs its cohort).
    const perfs = items.map((it) => videoPerformance(it.metrics));
    const batchMean = perfs.reduce((a, b) => a + b, 0) / Math.max(1, perfs.length);

    const results: Record<string, unknown>[] = [];
    for (let i = 0; i < items.length; i++) {
      const { concept_id, metrics } = items[i];
      const row = await db.get("VideoConcept", concept_id).catch(() => null) as Record<string, unknown> | null;
      const attributes = (row?.attributes as VideoConcept) || {};
      const performance = perfs[i];
      const weight = scoreVideoOutcome(metrics, batchMean);

      await recordVideoOutcome(db, {
        concept_id, attributes, weight,
        impressions: Math.max(0, Number(metrics.impressions) || 0), metrics, todayISO: now,
      });

      if (row) {
        await db.update("VideoConcept", concept_id, {
          phase: "tested", metrics, performance, outcome_weight: weight, tested_at: now, updated_at: now,
        }).catch(() => null);
      }
      results.push({ concept_id, performance, outcome_weight: weight, attributes });
    }

    return Response.json({ ok: true, ingested: results.length, batch_mean: Math.round(batchMean * 10000) / 10000, results });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
