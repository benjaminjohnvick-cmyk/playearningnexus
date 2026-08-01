import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { answerWall, isUnlocked, chatDailyLimit, CANNED_CHEERS } from "../../sdk/buddy.ts";

// buddySendMessage (authenticated) — send an ENCOURAGEMENT to your buddy. Canned cheers are always safe;
// free text passes the ANSWER-WALL (blocks anything that looks like sharing survey answers/content) and a
// daily rate limit. Nothing here lets buddies exchange answers.
//   Body: { pair_id, kind: "canned"|"text", text }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const pairId = String(body.pair_id || "");
    const kind = body.kind === "text" ? "text" : "canned";
    let text = String(body.text || "").trim();

    const pair = await db.get("BuddyPair", pairId).catch(() => null) as Record<string, unknown> | null;
    if (!pair || pair.status !== "active") return Response.json({ error: "No active buddy." }, { status: 404 });
    if (pair.user_a !== user.id && pair.user_b !== user.id) return Response.json({ error: "Not your buddy." }, { status: 403 });
    const buddyId = pair.user_a === user.id ? pair.user_b : pair.user_a;

    // Canned cheers must be from the safe list; free text must clear the answer-wall.
    if (kind === "canned") {
      if (!CANNED_CHEERS.includes(text)) text = CANNED_CHEERS[0];
    } else {
      const wall = answerWall(text);
      if (!wall.ok) return Response.json({ blocked: true, reason: wall.reason, message: "Keep it to encouragement — you can't share survey answers." }, { status: 422 });
    }

    // Rate limit (higher once unlocked).
    const today = new Date().toISOString().slice(0, 10);
    const unlocked = isUnlocked(Number(user.total_earnings) || 0);
    const sent = await db.filter("BuddyMessage", { pair_id: pairId, from_user_id: user.id, day: today }, "-created_date", 1000).catch(() => []) as unknown[];
    if ((sent || []).length >= chatDailyLimit(unlocked)) {
      return Response.json({ blocked: true, reason: "rate_limit", message: "You've hit today's chat limit." }, { status: 429 });
    }

    await base44.asServiceRole.entities.BuddyMessage.create({
      pair_id: pairId, from_user_id: user.id, to_user_id: buddyId, kind, text: text.slice(0, 280), day: today, flagged: false,
    });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
