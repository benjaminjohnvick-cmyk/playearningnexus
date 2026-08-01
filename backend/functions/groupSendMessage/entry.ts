import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isMember, scamGuardEnabled } from "../../sdk/group.ts";
import { answerWall, chatDailyLimit, isUnlocked, CANNED_CHEERS } from "../../sdk/buddy.ts";
import { scanMessage } from "../../sdk/scam-guard.ts";

// groupSendMessage (authenticated) — post an encouragement to your group. Same protections as buddy chat:
// answer-wall (no sharing survey answers) + anti-scam guard (no off-platform/payment/contact/links) + rate
// limit. Stored (retained for moderation).
//   Body: { session_id, kind: "canned"|"text", text }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const sessionId = String(body.session_id || "");
    const kind = body.kind === "text" ? "text" : "canned";
    let text = String(body.text || "").trim();

    const session = await db.get("GroupSession", sessionId).catch(() => null) as Record<string, unknown> | null;
    if (!session) return Response.json({ error: "Group not found" }, { status: 404 });
    if (!isMember(session, user.id)) return Response.json({ error: "Not your group." }, { status: 403 });

    if (kind === "canned") {
      if (!CANNED_CHEERS.includes(text)) text = CANNED_CHEERS[0];
    } else {
      const wall = answerWall(text);
      if (!wall.ok) return Response.json({ blocked: true, reason: wall.reason, message: "Keep it to encouragement — no sharing survey answers." }, { status: 422 });
      if (scamGuardEnabled()) {
        const scam = scanMessage(text);
        if (scam.blocked) return Response.json({ blocked: true, reason: `scam_${scam.category}`, message: scam.message }, { status: 422 });
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const unlocked = isUnlocked(Number(user.total_earnings) || 0);
    const sent = await db.filter("GroupMessage", { session_id: sessionId, from_user_id: user.id, day: today }, "-created_date", 1000).catch(() => []) as unknown[];
    if ((sent || []).length >= chatDailyLimit(unlocked)) {
      return Response.json({ blocked: true, reason: "rate_limit", message: "You've hit today's chat limit." }, { status: 429 });
    }

    await base44.asServiceRole.entities.GroupMessage.create({
      session_id: sessionId, from_user_id: user.id, from_name: user.full_name ? String(user.full_name).split(" ")[0] : "Member",
      kind, text: text.slice(0, 280), day: today, flagged: false,
    });
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
