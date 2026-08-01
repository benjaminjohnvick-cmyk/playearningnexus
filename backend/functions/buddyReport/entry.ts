import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";

// buddyReport (authenticated) — safety: report and/or leave a buddy. Ends the pair immediately and records
// the report for moderation. Either buddy can do this at any time; no questions asked.
//   Body: { pair_id, reason?, block? }  → { success }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const pairId = String(body.pair_id || "");
    const reason = String(body.reason || "").slice(0, 300);

    const pair = await db.get("BuddyPair", pairId).catch(() => null) as Record<string, unknown> | null;
    if (!pair) return Response.json({ error: "Not found" }, { status: 404 });
    if (pair.user_a !== user.id && pair.user_b !== user.id) return Response.json({ error: "Not your buddy." }, { status: 403 });
    const otherId = pair.user_a === user.id ? pair.user_b : pair.user_a;

    await db.update("BuddyPair", pairId, {
      status: "ended", ended_by: user.id, ended_at: new Date().toISOString(),
      reported: !!reason, report_reason: reason || null, blocked_pair: body.block ? [String(user.id), String(otherId)] : null,
    }).catch(() => null);

    if (reason) {
      // Surface to moderators (admin notification).
      const admins = await base44.asServiceRole.entities.User.filter({ role: "admin" }).catch(() => []);
      for (const a of (admins || []).slice(0, 5)) {
        await base44.asServiceRole.entities.Notification.create({
          user_id: (a as Record<string, unknown>).id, type: "moderation",
          title: "🚩 Buddy report", message: `A buddy pair was reported. Reason: ${reason.slice(0, 120)}`,
        }).catch(() => null);
      }
    }
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
