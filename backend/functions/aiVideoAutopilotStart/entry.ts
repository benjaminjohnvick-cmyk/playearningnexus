import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { autopilotEnabled, autopilotBatchSize } from "../../sdk/video-autopilot.ts";

// aiVideoAutopilotStart — kick off one end-to-end run. Runs the CHEAP, reversible stages automatically by
// reusing the existing functions in-process: refresh live trends → generate concepts → build a user poll.
// It then parks the run in "collecting" (gathering votes). aiVideoAutopilotTick later advances it to the
// human approval gate. No render spend happens here. Admin (or the seed-admin scheduler) only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    if (!autopilotEnabled()) return Response.json({ error: "Video Autopilot is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const day = now.slice(0, 10);
    const batch = Math.max(2, Math.min(2000, Number(body.batch_size) || autopilotBatchSize()));
    const steps: Record<string, unknown> = {};

    // 1) Refresh live trends (best-effort — the daily run also has a dedicated earlier trend job).
    if (body.refresh_trends !== false) {
      const t = await base44.functions.invoke("aiVideoEngineRefreshTrends", {}).catch((e: unknown) => ({ error: String(e) }));
      steps.trends = { refreshed: (t as Record<string, unknown>)?.refreshed ?? 0, source: (t as Record<string, unknown>)?.source };
    }

    // 2) Generate concepts (cheap — no render).
    const gen = await base44.functions.invoke("aiVideoEngineGenerate", { batch_size: batch }) as Record<string, unknown>;
    if (gen?.error) return Response.json({ error: `Generate failed: ${gen.error}` }, { status: 500 });
    steps.generate = { generated: gen.generated, space_size: gen.space_size };

    // 3) Build a user poll from the top concepts.
    const poll = await base44.functions.invoke("aiConceptPollCreate", {}) as Record<string, unknown>;
    if (poll?.error) return Response.json({ error: `Poll create failed: ${poll.error}` }, { status: 500 });
    steps.poll = { poll_id: poll.poll_id, matchups: poll.matchups, pool_size: poll.pool_size };

    const run = await db.create("VideoPipelineRun", {
      stage: "collecting",
      poll_id: poll.poll_id ?? null,
      concept_count: Number(gen.generated) || 0,
      pool_size: Number(poll.pool_size) || 0,
      votes: 0,
      candidates: [],
      est_cost_usd: 0,
      started_at: now,
      day,
      steps,
      created_at: now,
    }).catch(() => null) as Record<string, unknown> | null;

    return Response.json({
      ok: true, run_id: run?.id ?? null, stage: "collecting",
      poll_id: poll.poll_id ?? null, generated: gen.generated, pool_size: poll.pool_size,
      note: "Run started. It's collecting votes; the pipeline will select winners and wait for your approval before rendering.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
