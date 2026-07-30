import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { computeGroupProgress, rewardUsdFor, rewardPointsFor } from "../../sdk/group-goals.ts";

// claimGroupGoalReward — once a group has collectively REACHED its goal, each member claims the
// PLATFORM-FUNDED reward for THEIR OWN account: non-cashable, closed-loop store-credit points, capped.
// This is the ONLY money-touching step, and value flows platform → member only (never member → member).
//
// Idempotency: one GroupGoalReward row per (group, member), keyed by a deterministic id, so a member can
// never double-claim — a duplicate insert hits the primary key and is treated as already-claimed. Points
// are granted ONLY after that claim row is successfully created.
//   Body: { group_id }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await isEnabled("group_goals"))) {
      return Response.json({ blocked: true, message: "Group goals aren't available right now." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const groupId = String(body.group_id || "");
    if (!groupId) return Response.json({ error: "group_id is required" }, { status: 400 });

    const rows = await base44.asServiceRole.entities.GroupGoal.filter({ id: groupId }).catch(() => []);
    const group = (rows || [])[0];
    if (!group) return Response.json({ error: "Group not found" }, { status: 404 });
    const members: string[] = Array.isArray(group.member_ids) ? group.member_ids : [];
    if (!members.includes(user.id)) return Response.json({ error: "You are not a member of this group" }, { status: 403 });

    // RE-VERIFY the milestone server-side by reading each member's OWN current earnings (no value moved).
    const usersById: Record<string, number> = {};
    await Promise.all(members.map(async (uid) => {
      const u = await base44.asServiceRole.entities.User.filter({ id: uid }).catch(() => []);
      usersById[uid] = Number(u?.[0]?.total_earnings) || 0;
    }));
    const prog = computeGroupProgress(group, usersById);
    if (!prog.reached) {
      return Response.json({ error: "not_yet_reached", message: "Your group hasn't reached its goal yet — keep earning!", progress_usd: prog.progress_usd, milestone_usd: prog.milestone_usd }, { status: 403 });
    }

    const targetUsd = Number(group.target_usd) || 0;
    const points = rewardPointsFor(targetUsd);
    const rewardUsd = rewardUsdFor(targetUsd);
    if (points <= 0) return Response.json({ error: "No reward configured" }, { status: 400 });

    // Idempotency guard: deterministic per-(group, member) claim row.
    const claimId = `${groupId}__${user.id}`;
    const existing = await base44.asServiceRole.entities.GroupGoalReward.filter({ id: claimId }).catch(() => []);
    if ((existing || []).length) {
      return Response.json({ success: true, already_claimed: true, points, reward_usd: rewardUsd });
    }
    try {
      await base44.asServiceRole.entities.GroupGoalReward.create({
        id: claimId, group_id: groupId, user_id: user.id, points, reward_usd: rewardUsd,
        target_item: group.target_item, at: new Date().toISOString(),
      });
    } catch {
      // Primary-key collision → another concurrent claim won. Treat as already claimed; do NOT grant again.
      return Response.json({ success: true, already_claimed: true, points, reward_usd: rewardUsd });
    }

    // Grant the platform-funded reward to the member's OWN points balance (non-cashable, closed-loop).
    // NOTE: we credit `points`, NOT `total_earnings`, so the promo reward never feeds back into group
    // baselines (which key off total_earnings) — no circular progress.
    await adjustUserBalance(user.id, points, { field: "points" });

    // Best-effort: reflect the claim on the group for status display (non-authoritative; the claim row
    // above is the source of truth for idempotency).
    for (let i = 0; i < 4; i++) {
      const fresh = (await base44.asServiceRole.entities.GroupGoal.filter({ id: groupId }).catch(() => []))?.[0];
      if (!fresh) break;
      const claimed: string[] = Array.isArray(fresh.reward_claimed_by) ? fresh.reward_claimed_by : [];
      if (claimed.includes(user.id)) break;
      const patch: Record<string, unknown> = { reward_claimed_by: [...claimed, user.id] };
      if (!fresh.reached_at) patch.reached_at = new Date().toISOString();
      const ok = await base44.asServiceRole.entities.GroupGoal.update(groupId, patch).catch(() => null);
      if (ok) break;
    }

    await base44.asServiceRole.entities.Notification.create({
      user_id: user.id,
      type: "group_goal_reward",
      title: "🎯 Group goal reached!",
      message: `Your group hit its goal for "${group.target_item}". We've added ${points.toLocaleString()} bonus points (a $${rewardUsd.toFixed(2)} platform reward) to your account — put them toward it!`,
      status: "unread",
      delivery_method: ["in_app"],
    }).catch(() => null);

    return Response.json({ success: true, points_granted: points, reward_usd: rewardUsd });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
