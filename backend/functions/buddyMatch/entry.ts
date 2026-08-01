import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { buddyEnabled } from "../../sdk/buddy.ts";

// buddyMatch (authenticated) — pair the user with an available buddy for accountability while earning. If
// they already have an active buddy, returns it. Otherwise joins someone who's waiting, or creates a waiting
// slot. Pairing is opt-in and there's always a solo fallback — this never blocks anyone from earning.
//   Body: {}  → { status: "active"|"waiting", pair_id, buddy_user_id? }
async function activePairFor(uid: string) {
  const a = await db.filter("BuddyPair", { user_a: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
  if (a?.[0]) return a[0];
  const b = await db.filter("BuddyPair", { user_b: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
  return b?.[0] || null;
}

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!buddyEnabled()) return Response.json({ status: "disabled" });

    const existing = await activePairFor(user.id);
    if (existing) {
      const buddyId = existing.user_a === user.id ? existing.user_b : existing.user_a;
      return Response.json({ status: "active", pair_id: existing.id, buddy_user_id: buddyId });
    }

    // Join someone who's waiting (not me).
    const waiting = await db.filter("BuddyPair", { status: "waiting" }, "-created_date", 50).catch(() => []) as Record<string, unknown>[];
    const open = (waiting || []).find((p) => p.user_a && p.user_a !== user.id && !p.user_b);
    if (open) {
      await db.update("BuddyPair", open.id as string, { user_b: user.id, status: "active", matched_at: new Date().toISOString() }).catch(() => null);
      // Let the waiting user know they've been matched.
      await base44.asServiceRole.entities.Notification.create({
        user_id: open.user_a, type: "social", title: "👥 You've got an earning buddy!",
        message: "Someone just paired up with you — cheer each other on and keep earning.",
      }).catch(() => null);
      return Response.json({ status: "active", pair_id: open.id, buddy_user_id: open.user_a });
    }

    // Otherwise wait for a partner (solo earning still works meanwhile).
    const created = await base44.asServiceRole.entities.BuddyPair.create({
      user_a: user.id, user_b: null, status: "waiting", source: "queue", created_day: new Date().toISOString().slice(0, 10),
    });
    return Response.json({ status: "waiting", pair_id: created.id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
