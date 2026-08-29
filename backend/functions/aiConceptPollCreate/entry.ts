import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { conceptPollEnabled, buildMatchups, pollSetSize, pollPoolSize } from "../../sdk/concept-polling.ts";

// aiConceptPollCreate — turn auto-generated video CONCEPTS into a user poll. Pulls a pool of the top recent
// compliant concepts (or a supplied concept_ids list), builds balanced head-to-head / MaxDiff matchups, and
// persists a ConceptPoll (status "open"). Users then vote via aiConceptPollNext/Vote, and the winners feed the
// video playbook via aiConceptPollLearn. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    if (!conceptPollEnabled()) return Response.json({ error: "Concept polling is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const now = new Date().toISOString();
    const day = now.slice(0, 10);
    const setSize = Math.max(2, Math.min(5, Number(body.set_size) || pollSetSize()));
    const poolSize = Math.max(setSize, Math.min(60, Number(body.pool_size) || pollPoolSize()));

    // Resolve the concept pool: explicit ids, else the top recent compliant concepts by predictive score.
    let rows: Record<string, unknown>[] = [];
    if (Array.isArray(body.concept_ids) && body.concept_ids.length) {
      for (const id of body.concept_ids.slice(0, poolSize)) {
        const r = await db.get("VideoConcept", String(id)).catch(() => null) as Record<string, unknown> | null;
        if (r) rows.push(r);
      }
    } else {
      rows = await db.filter("VideoConcept", { phase: "concept", compliant: true }, "-predictive_score", poolSize).catch(() => []) as Record<string, unknown>[];
    }
    if (rows.length < setSize) {
      return Response.json({ error: `Need at least ${setSize} concepts to build a poll. Generate concepts first (aiVideoEngineGenerate).`, have: rows.length }, { status: 400 });
    }

    const pool = rows.map((r) => ({
      id: String(r.id),
      attributes: r.attributes || {},
      trend: r.trend || null,
      hook_line: r.hook_line || null,
      brief: String(r.brief || "").slice(0, 400),
      predictive_score: Number(r.predictive_score) || 0,
    }));
    const matchups = buildMatchups(pool.map((p) => p.id), { setSize, seed: `${day}-${rows.length}` });

    const doc = {
      title: String(body.title || `Concept poll — ${day}`).slice(0, 120),
      method: setSize === 2 ? "head_to_head" : "maxdiff",
      set_size: setSize,
      pool,
      matchups,
      status: "open",
      votes: 0,
      day,
      created_at: now,
    };
    const saved = await db.create("ConceptPoll", doc).catch(() => null) as Record<string, unknown> | null;
    return Response.json({
      ok: true, poll_id: saved?.id ?? null, method: doc.method, set_size: setSize,
      pool_size: pool.length, matchups: matchups.length,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
