import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  videoEngineEnabled, renderBudget, selectForRender, screenConcept,
  type ScoredConcept, type VideoConcept,
} from "../../sdk/video-engine.ts";

// aiVideoEngineRenderWinners — the PHASED spend gate. Takes the top-scoring compliant concepts, up to the
// daily render count AND the daily $ cap, writes each a real script + storyboard (and a thumbnail if images
// are on), and marks them rendered/queued. If the render provider is "none" (default), it selects the winners
// and returns them as "would render" WITHOUT any spend. Admin only. Never moves money beyond render spend,
// which is hard-capped.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    if (!videoEngineEnabled()) return Response.json({ error: "The AI Video Engine is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const day = now.slice(0, 10);
    const budget = renderBudget();

    // Candidate pool: today's compliant concepts still in the "concept" phase, best score first.
    const pool = await db.filter("VideoConcept", { phase: "concept", compliant: true }, "-predictive_score", 500).catch(() => []) as Record<string, unknown>[];
    const scored: ScoredConcept[] = (pool || []).map((r) => ({
      id: String(r.id ?? ""),
      concept: (r.attributes as VideoConcept) || {},
      score: Number(r.predictive_score) || 0,
      compliant: r.compliant !== false,
    }));

    // How much has already been rendered/spent today (for the caps).
    const renderedToday = await db.count("VideoConcept", { day, phase: "rendered" }).catch(() => 0);
    const spentToday = renderedToday * budget.est_cost_per_render_usd;

    const sel = selectForRender(scored, {
      rendered_today: renderedToday, spent_today_usd: spentToday,
      limit: Number(body.limit) || undefined, budget,
    });

    if (budget.provider === "none") {
      return Response.json({
        ok: true, provider: "none", would_render: sel.selected.length,
        note: "Render provider is 'none' — winners selected but NOT rendered (zero spend). Set VIDEO_ENGINE_RENDER_PROVIDER to enable paid rendering.",
        budget, selected: sel.selected.slice(0, 50).map((s) => ({ id: s.id, score: s.score, attributes: s.concept })),
        reason: sel.reason,
      });
    }

    // Provider enabled: generate the real script/storyboard for each winner and mark it rendered.
    const wantThumb = body.thumbnails !== false;
    const rendered: Record<string, unknown>[] = [];
    for (const s of sel.selected) {
      const row = pool.find((p) => String(p.id) === s.id);
      const brief = String(row?.brief ?? "");
      let script = "", storyboard: unknown = null, thumbnail_url = "";
      const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Write a short-form vertical video from this concept brief. Keep it 100% compliant: sell the experience and delivered value, NEVER a financial return, ROI, guaranteed earnings, "2x", or risk-free framing (rewards are non-cashable store credit; results vary).
BRIEF: ${brief}
Return: script (spoken/on-screen lines, timestamped), storyboard (array of {t, shot, on_screen_text}), and hook_line.`,
        response_json_schema: {
          type: "object",
          properties: {
            script: { type: "string" },
            hook_line: { type: "string" },
            storyboard: { type: "array", items: { type: "object", properties: { t: { type: "string" }, shot: { type: "string" }, on_screen_text: { type: "string" } } } },
            image_prompt: { type: "string" },
          },
        },
      }).catch(() => null) as Record<string, unknown> | null;
      script = String(res?.script ?? "");
      storyboard = res?.storyboard ?? null;

      // Compliance re-screen on the generated script; skip a winner that slips a banned claim.
      if (script && !screenConcept({ concept: s.concept, script }).ok) {
        await db.update("VideoConcept", s.id!, { phase: "blocked", blocked_reason: "script failed compliance", updated_at: now }).catch(() => null);
        continue;
      }

      if (wantThumb && res?.image_prompt) {
        const img = await base44.asServiceRole.integrations.Core.GenerateImage({ prompt: `Vertical 9:16 thumbnail, leave clean space for a logo watermark. ${String(res.image_prompt).slice(0, 400)}` }).catch(() => null) as Record<string, unknown> | null;
        thumbnail_url = String(img?.url ?? "");
      }

      await db.update("VideoConcept", s.id!, {
        phase: "rendered", script, storyboard, thumbnail_url,
        hook_line: String(res?.hook_line ?? ""), render_provider: budget.provider,
        est_cost_usd: budget.est_cost_per_render_usd, rendered_at: now, updated_at: now,
      }).catch(() => null);
      rendered.push({ id: s.id, score: s.score, attributes: s.concept, thumbnail_url });
    }

    return Response.json({
      ok: true, provider: budget.provider,
      rendered: rendered.length, est_cost_usd: Math.round(rendered.length * budget.est_cost_per_render_usd * 100) / 100,
      budget, reason: sel.reason, items: rendered.slice(0, 50),
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
