import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { conceptPollEnabled, tallyBestWorst, rankConcepts, totalVotes, pollMinVotes } from "../../sdk/concept-polling.ts";

// aiConceptPollResults — tally a poll's votes into a MaxDiff/head-to-head ranking of which concepts poll
// higher, joined with each concept's creative attributes. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    if (!conceptPollEnabled()) return Response.json({ error: "Concept polling is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const pollId = String(body.poll_id ?? url.searchParams.get("poll_id") ?? "");
    let poll: Record<string, unknown> | null = null;
    if (pollId) poll = await db.get("ConceptPoll", pollId).catch(() => null) as Record<string, unknown> | null;
    else poll = ((await db.filter("ConceptPoll", {}, "-created_at", 1).catch(() => [])) as Record<string, unknown>[])[0] ?? null;
    if (!poll) return Response.json({ error: "Poll not found." }, { status: 404 });

    const votes = await db.filter("ConceptPollVote", { poll_id: poll.id }, "-created_at", 20000).catch(() => []) as Record<string, unknown>[];
    const raw = (votes || []).map((v) => ({ set: (v.set as string[]) || [], best: String(v.best ?? ""), worst: v.worst ? String(v.worst) : undefined }));
    const tally = tallyBestWorst(raw);
    const ranked = rankConcepts(tally);

    const pool = (poll.pool as Record<string, unknown>[]) || [];
    const byId = new Map(pool.map((p) => [String(p.id), p]));
    const leaderboard = ranked.map((t) => {
      const p = byId.get(t.id) || {};
      return {
        id: t.id, score: t.score, appearances: t.appearances, best: t.best, worst: t.worst,
        attributes: p.attributes || {}, trend: (p.trend as Record<string, unknown>)?.topic ?? null,
        predictive_score: p.predictive_score ?? null,
      };
    });

    const votesTotal = totalVotes(tally, Number(poll.set_size) || 2);
    const minVotes = pollMinVotes();
    return Response.json({
      poll_id: poll.id, title: poll.title, method: poll.method, status: poll.status,
      votes: votesTotal, min_votes: minVotes, stable: votesTotal >= minVotes,
      leaderboard,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
