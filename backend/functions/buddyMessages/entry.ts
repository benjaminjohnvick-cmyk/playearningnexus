import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// buddyMessages (authenticated) — recent encouragement messages for the user's buddy pair. Membership-checked
// (only the two buddies can read). Read-only.
//   Body: { pair_id, limit? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const pairId = String(body.pair_id || "");
    const limit = Math.max(1, Math.min(200, Number(body.limit) || 50));

    const pair = await db.get("BuddyPair", pairId).catch(() => null) as Record<string, unknown> | null;
    if (!pair) return Response.json({ error: "Not found" }, { status: 404 });
    if (pair.user_a !== user.id && pair.user_b !== user.id) return Response.json({ error: "Not your buddy." }, { status: 403 });

    const rows = await db.filter("BuddyMessage", { pair_id: pairId }, "-created_date", limit).catch(() => []) as Record<string, unknown>[];
    const messages = (rows || []).filter((m) => !m.flagged).map((m) => ({
      id: m.id, from_me: m.from_user_id === user.id, kind: m.kind, text: m.text, at: m.created_date,
    })).reverse();

    return Response.json({ messages });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
