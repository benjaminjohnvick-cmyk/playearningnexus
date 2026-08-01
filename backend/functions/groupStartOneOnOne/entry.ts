import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isMember } from "../../sdk/group.ts";
import { pairKey } from "../../sdk/buddy.ts";

// groupStartOneOnOne (authenticated) — the consent-progressive path to 1:1: after sharing a GROUP session,
// two members can MUTUALLY opt into a private 1:1 (which becomes a normal buddy pair, with all its chat
// protections). It only activates once BOTH have opted in. In-app only — no contact-info exchange, no meetups.
//   Body: { session_id, target_user_id }  → { status: "active"|"pending" }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const target = String(body.target_user_id || "");
    if (!target || target === user.id) return Response.json({ error: "Pick a group member." }, { status: 400 });

    // Both must belong to the same group (the "been in a group first" gate).
    const session = await db.get("GroupSession", String(body.session_id || "")).catch(() => null) as Record<string, unknown> | null;
    if (!session) return Response.json({ error: "Group not found" }, { status: 404 });
    if (!isMember(session, user.id) || !isMember(session, target)) return Response.json({ error: "Both must be in this group." }, { status: 403 });

    const { user_a, user_b } = pairKey(user.id, target);
    const existing = await db.filter("BuddyPair", { user_a, user_b }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const pair = existing?.[0] || null;

    if (pair && pair.status === "active") return Response.json({ status: "active", pair_id: pair.id });
    if (pair && pair.status === "pending" && pair.connect_request_by && pair.connect_request_by !== user.id) {
      await db.update("BuddyPair", pair.id as string, { status: "active", matched_at: new Date().toISOString() }).catch(() => null);
      await base44.asServiceRole.entities.Notification.create({
        user_id: target, type: "social", title: "👥 You're now 1:1 buddies", message: "You both opted to pair up from your group — keep cheering each other on.",
      }).catch(() => null);
      return Response.json({ status: "active", pair_id: pair.id });
    }

    if (pair) {
      await db.update("BuddyPair", pair.id as string, { status: "pending", connect_request_by: user.id }).catch(() => null);
      return Response.json({ status: "pending", pair_id: pair.id, message: "Sent — you'll pair up once they opt in too." });
    }
    const created = await base44.asServiceRole.entities.BuddyPair.create({
      user_a, user_b, status: "pending", source: "from_group", connect_request_by: user.id, created_day: new Date().toISOString().slice(0, 10),
    });
    return Response.json({ status: "pending", pair_id: created.id, message: "Sent — you'll pair up once they opt in too." });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
