import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { computeGroupProgress, rewardUsdFor, rewardPointsFor, GROUP_GOAL_DISCLOSURE } from "../../sdk/group-goals.ts";

// groupGoalStatus (authenticated, READ-ONLY) — reports progress. Nothing is moved or mutated here; it
// only READS each member's own current earnings and SUMS the individual progress toward the shared goal.
//   Body: { group_id? }
//     - with group_id  → full status for that one group (caller must be a member)
//     - without        → a list of the caller's groups with summed progress
async function earningsByIds(base44: ReturnType<typeof createClientFromRequest>, ids: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all((ids || []).map(async (uid) => {
    const rows = await base44.asServiceRole.entities.User.filter({ id: uid }).catch(() => []);
    out[uid] = Number((rows?.[0]?.total_earnings)) || 0;
  }));
  return out;
}

function viewFor(group: Record<string, unknown>, usersById: Record<string, number>, meId: string) {
  const prog = computeGroupProgress(group, usersById);
  const names = (group.member_names || {}) as Record<string, string>;
  const claimed = Array.isArray(group.reward_claimed_by) ? group.reward_claimed_by as string[] : [];
  const targetUsd = Number(group.target_usd) || 0;
  return {
    group_id: group.id,
    name: group.name,
    target_item: group.target_item,
    target_usd: targetUsd,
    milestone_usd: prog.milestone_usd,
    progress_usd: prog.progress_usd,
    progress_pct: prog.milestone_usd > 0 ? Math.min(100, Math.round((prog.progress_usd / prog.milestone_usd) * 1000) / 10) : 0,
    reached: prog.reached,
    invite_code: group.invite_code,
    member_count: (group.member_ids as string[] || []).length,
    max_members: Number(group.max_members) || 10,
    members: prog.per_member.map((m) => ({ user_id: m.user_id, name: names[m.user_id] || "Member", progress_usd: m.progress_usd, is_me: m.user_id === meId })),
    reward_usd_each: rewardUsdFor(targetUsd),
    reward_points_each: rewardPointsFor(targetUsd),
    reward_claimed_by_me: claimed.includes(meId),
    can_claim: prog.reached && !claimed.includes(meId),
    disclosure: GROUP_GOAL_DISCLOSURE,
  };
}

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const groupId = body.group_id ? String(body.group_id) : null;

    if (groupId) {
      const rows = await base44.asServiceRole.entities.GroupGoal.filter({ id: groupId }).catch(() => []);
      const group = (rows || [])[0];
      if (!group) return Response.json({ error: "Group not found" }, { status: 404 });
      const members: string[] = Array.isArray(group.member_ids) ? group.member_ids : [];
      if (!members.includes(user.id)) return Response.json({ error: "You are not a member of this group" }, { status: 403 });
      const usersById = await earningsByIds(base44, members);
      return Response.json({ group: viewFor(group, usersById, user.id) });
    }

    // List the caller's groups. Bounded scan (early scale is small); filter by membership in code.
    const all = await base44.asServiceRole.entities.GroupGoal.filter({}, "-created_date", 1000).catch(() => []);
    const mine = (all || []).filter((g: Record<string, unknown>) => Array.isArray(g.member_ids) && (g.member_ids as string[]).includes(user.id));
    const groups = await Promise.all(mine.map(async (g: Record<string, unknown>) => {
      const usersById = await earningsByIds(base44, (g.member_ids as string[]) || []);
      return viewFor(g, usersById, user.id);
    }));
    return Response.json({ groups, count: groups.length, disclosure: GROUP_GOAL_DISCLOSURE });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
