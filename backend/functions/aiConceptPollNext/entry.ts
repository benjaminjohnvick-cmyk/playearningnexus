import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { conceptPollEnabled } from "../../sdk/concept-polling.ts";

// aiConceptPollNext — serve the current user the next matchup to vote on. Picks the newest open poll (or a
// given poll_id), skips matchups this user has already voted on (sequential), and returns the concept
// previews for the set. Any signed-in user. Returns { done: true } when the user has voted on every matchup.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!conceptPollEnabled()) return Response.json({ error: "Concept polling is disabled." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    const pollId = String(body.poll_id ?? url.searchParams.get("poll_id") ?? "");

    let poll: Record<string, unknown> | null = null;
    if (pollId) {
      poll = await db.get("ConceptPoll", pollId).catch(() => null) as Record<string, unknown> | null;
    } else {
      const open = await db.filter("ConceptPoll", { status: "open" }, "-created_at", 1).catch(() => []) as Record<string, unknown>[];
      poll = open?.[0] ?? null;
    }
    if (!poll) return Response.json({ done: true, reason: "no open poll" });

    const matchups = (poll.matchups as string[][]) || [];
    const pool = (poll.pool as Record<string, unknown>[]) || [];
    const byId = new Map(pool.map((p) => [String(p.id), p]));

    // How many has this user already voted on in this poll? Serve the next one.
    const voted = await db.count("ConceptPollVote", { poll_id: poll.id, user_id: user.id }).catch(() => 0);
    if (voted >= matchups.length) return Response.json({ done: true, poll_id: poll.id, voted });

    const set = matchups[voted] || [];
    const options = set.map((id) => {
      const p = byId.get(String(id)) || { id };
      const a = (p.attributes as Record<string, string>) || {};
      return {
        id: String(id),
        hook: a.hook, visual_style: a.visual_style, pacing: a.pacing, cta_style: a.cta_style,
        duration: a.duration, theme: a.theme, trend_angle: a.trend_angle,
        trend_topic: (p.trend as Record<string, unknown>)?.topic ?? null,
        hook_line: p.hook_line ?? null,
        brief: p.brief ?? null,
      };
    });

    return Response.json({
      done: false,
      poll_id: poll.id,
      title: poll.title,
      method: poll.method,
      set_size: poll.set_size,
      index: voted,
      total: matchups.length,
      set,
      options,
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
