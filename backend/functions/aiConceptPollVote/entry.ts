import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { conceptPollEnabled, normalizeVote } from "../../sdk/concept-polling.ts";

// aiConceptPollVote — record one user's vote on a matchup: { poll_id, set:[ids], best, worst? }. For a
// head-to-head (set of 2) only `best` is needed — the other is the implied loser. Persists a ConceptPollVote
// and bumps the poll's vote counter. Any signed-in user. Idempotent-ish: re-voting the same set is ignored.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!conceptPollEnabled()) return Response.json({ error: "Concept polling is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const pollId = String(body.poll_id ?? "");
    if (!pollId) return Response.json({ error: "poll_id is required." }, { status: 400 });

    const poll = await db.get("ConceptPoll", pollId).catch(() => null) as Record<string, unknown> | null;
    if (!poll) return Response.json({ error: "Poll not found." }, { status: 404 });
    if (poll.status !== "open") return Response.json({ error: "This poll is closed." }, { status: 409 });

    const norm = normalizeVote({ set: (body.set || []).map(String), best: String(body.best ?? ""), worst: body.worst ? String(body.worst) : undefined });
    if (!norm) return Response.json({ error: "Invalid vote — 'best' must be one of the concepts in 'set'." }, { status: 400 });

    // Guard: the chosen concepts must belong to this poll's pool.
    const poolIds = new Set(((poll.pool as Record<string, unknown>[]) || []).map((p) => String(p.id)));
    if (!norm.set.every((id) => poolIds.has(id))) return Response.json({ error: "Vote references concepts not in this poll." }, { status: 400 });

    const now = new Date().toISOString();
    await db.create("ConceptPollVote", {
      poll_id: pollId, user_id: user.id, set: norm.set, best: norm.best, worst: norm.worst ?? null, at: now, created_at: now,
    }).catch(() => null);
    await db.update("ConceptPoll", pollId, { votes: (Number(poll.votes) || 0) + 1, updated_at: now }).catch(() => null);

    return Response.json({ ok: true, poll_id: pollId, recorded: { best: norm.best, worst: norm.worst ?? null } });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
