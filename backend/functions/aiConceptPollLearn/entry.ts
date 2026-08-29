import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { conceptPollEnabled, tallyBestWorst, pollLearningRows, totalVotes, pollMinVotes } from "../../sdk/concept-polling.ts";
import { recordVideoOutcome, type VideoConcept } from "../../sdk/video-engine.ts";

// aiConceptPollLearn — turn a poll's results into learning signals for the SAME video playbook: each concept's
// preference score (relative to the poll mean) becomes a signed weight on its creative dimensions, recorded via
// recordVideoOutcome. So "users preferred the question-hook, current-event concepts" biases the next
// generation — surveys become a pre-render signal in the same data-driven loop. Admin only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });
    if (!conceptPollEnabled()) return Response.json({ error: "Concept polling is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const pollId = String(body.poll_id ?? "");
    if (!pollId) return Response.json({ error: "poll_id is required." }, { status: 400 });
    const poll = await db.get("ConceptPoll", pollId).catch(() => null) as Record<string, unknown> | null;
    if (!poll) return Response.json({ error: "Poll not found." }, { status: 404 });

    const votes = await db.filter("ConceptPollVote", { poll_id: pollId }, "-created_at", 20000).catch(() => []) as Record<string, unknown>[];
    const raw = (votes || []).map((v) => ({ set: (v.set as string[]) || [], best: String(v.best ?? ""), worst: v.worst ? String(v.worst) : undefined }));
    const tally = tallyBestWorst(raw);

    const votesTotal = totalVotes(tally, Number(poll.set_size) || 2);
    const minVotes = pollMinVotes();
    if (!body.force && votesTotal < minVotes) {
      return Response.json({ error: `Only ${votesTotal} votes — need ${minVotes} for a stable result. Pass force:true to learn anyway.`, votes: votesTotal, min_votes: minVotes }, { status: 409 });
    }

    const pool = (poll.pool as Record<string, unknown>[]) || [];
    const concepts = pool.map((p) => ({ id: String(p.id), attributes: (p.attributes as Record<string, string>) || {} }));
    const rows = pollLearningRows(tally, concepts);

    const now = new Date().toISOString();
    let learned = 0;
    for (const r of rows) {
      await recordVideoOutcome(db, {
        concept_id: r.concept_id,
        attributes: r.attributes as VideoConcept,
        weight: r.weight,
        impressions: r.impressions,
        todayISO: now,
      });
      // Mark the concept row with its poll result for traceability.
      await db.update("VideoConcept", r.concept_id, { poll_score: r.weight, poll_id: pollId, updated_at: now }).catch(() => null);
      learned++;
    }
    await db.update("ConceptPoll", pollId, { status: "learned", learned_at: now, votes: (Number(poll.votes) || 0), updated_at: now }).catch(() => null);

    const top = rows.slice().sort((a, b) => b.weight - a.weight).slice(0, 5).map((r) => ({ concept_id: r.concept_id, attributes: r.attributes, weight: r.weight }));
    return Response.json({ ok: true, poll_id: pollId, signals_recorded: learned, votes: votesTotal, top });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
