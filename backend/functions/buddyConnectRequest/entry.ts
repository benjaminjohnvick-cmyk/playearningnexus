import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isUnlocked } from "../../sdk/buddy.ts";

// buddyConnectRequest (authenticated) — the $9-unlock reward: an OPT-IN, MUTUAL, IN-APP connection between
// buddies (add-as-friend within the app). Both must be unlocked (cumulative earnings ≥ threshold) AND both
// must request it before they're connected. This is in-app only — it deliberately does NOT arrange
// real-world meetings, for user-safety reasons.
//   Body: { pair_id }  → { connected, waiting_on_buddy }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!isUnlocked(Number(user.total_earnings) || 0)) {
      return Response.json({ error: "locked", message: "Keep earning to unlock connecting with your buddy." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const pairId = String(body.pair_id || "");
    const pair = await db.get("BuddyPair", pairId).catch(() => null) as Record<string, unknown> | null;
    if (!pair || pair.status !== "active") return Response.json({ error: "No active buddy." }, { status: 404 });
    if (pair.user_a !== user.id && pair.user_b !== user.id) return Response.json({ error: "Not your buddy." }, { status: 403 });

    const requestedBy = pair.connect_request_by ? String(pair.connect_request_by) : null;

    // If the OTHER buddy already requested, this request completes a mutual, opt-in connection.
    if (requestedBy && requestedBy !== user.id) {
      await db.update("BuddyPair", pairId, { connected: true, connected_at: new Date().toISOString() }).catch(() => null);
      const otherId = pair.user_a === user.id ? pair.user_b : pair.user_a;
      await base44.asServiceRole.entities.Notification.create({
        user_id: otherId, type: "social", title: "🤝 You're connected!",
        message: "You and your earning buddy both chose to connect. You can keep chatting in-app.",
      }).catch(() => null);
      return Response.json({ connected: true, waiting_on_buddy: false });
    }

    // Otherwise record this user's request and wait for the buddy to opt in too.
    await db.update("BuddyPair", pairId, { connect_request_by: user.id }).catch(() => null);
    return Response.json({ connected: false, waiting_on_buddy: true, message: "Sent — you'll connect once your buddy opts in too." });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
