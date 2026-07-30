import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { groupGoalMaxMembers, rewardUsdFor, GROUP_GOAL_DISCLOSURE } from "../../sdk/group-goals.ts";

// createGroupGoal — start a COMPLIANT group goal (each member keeps their own points; NO shared pool).
// The creator becomes the owner + first member, and their current lifetime earnings are snapshotted as
// their baseline so only earnings from here forward count toward the shared goal. Returns an invite code.
//   Body: { name, target_item, target_usd, milestone_usd?, max_members? }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await isEnabled("group_goals"))) {
      return Response.json({ blocked: true, message: "Group goals aren't available right now." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    const targetItem = String(body.target_item || "").trim();
    const targetUsd = Math.max(0, Number(body.target_usd) || 0);
    if (!name || !targetItem || targetUsd <= 0) {
      return Response.json({ error: "name, target_item, and a positive target_usd are required" }, { status: 400 });
    }
    // Milestone = the shared earning goal. Defaults to the item's price (earn the item's cost together).
    const milestoneUsd = Math.max(1, Number(body.milestone_usd) || targetUsd);
    const maxMembers = Math.min(groupGoalMaxMembers(), Math.max(2, Math.round(Number(body.max_members) || groupGoalMaxMembers())));

    // Baseline = the member's CURRENT lifetime realized earnings; only future earnings count toward the goal.
    const baseline = Number(user.total_earnings) || 0;

    // Short, human-friendly invite code (index-free randomness is fine here; collisions just retry via join).
    const code = (name.replace(/[^A-Za-z0-9]/g, "").slice(0, 4).toUpperCase() || "GOAL") +
      String(Math.floor(1000 + (Number(user.id?.toString().slice(-4).replace(/\D/g, "")) || (Date.now() % 9000)) % 9000));

    const group = await base44.asServiceRole.entities.GroupGoal.create({
      name,
      target_item: targetItem,
      target_usd: targetUsd,
      milestone_usd: milestoneUsd,
      owner_user_id: user.id,
      member_ids: [user.id],
      member_names: { [user.id]: user.full_name || "Member" },
      member_baselines: { [user.id]: baseline },
      reward_claimed_by: [],
      max_members: maxMembers,
      invite_code: code,
      status: "active",
      created_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      group_id: group.id,
      invite_code: code,
      reward_usd_each: rewardUsdFor(targetUsd),
      disclosure: GROUP_GOAL_DISCLOSURE,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
