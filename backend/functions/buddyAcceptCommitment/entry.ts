import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { buddyCommitTargetUsd } from "../../sdk/buddy.ts";

// buddyAcceptCommitment (authenticated) — record that this user AGREED to the buddy-chat commitment: to earn
// their daily take-home ($4.50, their half of $9) as part of using buddy chat. This is a consent/accountability
// record, applied to ALL tiers. It does NOT trap anyone — Leave and Report stay available at all times.
//   Body: { pair_id }  → { success, committed, target_usd }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const pairId = String(body.pair_id || "");
    const pair = await db.get("BuddyPair", pairId).catch(() => null) as Record<string, unknown> | null;
    if (!pair || pair.status !== "active") return Response.json({ error: "No active buddy." }, { status: 404 });
    if (pair.user_a !== user.id && pair.user_b !== user.id) return Response.json({ error: "Not your buddy." }, { status: 403 });

    const side = pair.user_a === user.id ? "committed_a" : "committed_b";
    await db.update("BuddyPair", pairId, { [side]: true, [`${side}_at`]: new Date().toISOString(), commit_target_usd: buddyCommitTargetUsd() }).catch(() => null);

    return Response.json({ success: true, committed: true, target_usd: buddyCommitTargetUsd() });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
