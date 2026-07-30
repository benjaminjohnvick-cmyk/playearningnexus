import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";
import { GROUP_GOAL_DISCLOSURE } from "../../sdk/group-goals.ts";

// joinGroupGoal — join a friend's group goal by invite code. The joiner's CURRENT lifetime earnings are
// snapshotted as their baseline, so only what they earn from here forward counts toward the shared goal.
// No value is pooled or transferred — the member simply starts contributing their own progress.
//   Body: { invite_code }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await isEnabled("group_goals"))) {
      return Response.json({ blocked: true, message: "Group goals aren't available right now." }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const code = String(body.invite_code || "").trim().toUpperCase();
    if (!code) return Response.json({ error: "invite_code is required" }, { status: 400 });

    const groups = await base44.asServiceRole.entities.GroupGoal.filter({ invite_code: code }).catch(() => []);
    const group = (groups || [])[0];
    if (!group) return Response.json({ error: "No group found for that code" }, { status: 404 });
    if (group.status === "closed") return Response.json({ error: "That group is closed" }, { status: 409 });

    const members: string[] = Array.isArray(group.member_ids) ? group.member_ids : [];
    if (members.includes(user.id)) {
      return Response.json({ success: true, already_member: true, group_id: group.id });
    }
    if (members.length >= (Number(group.max_members) || 10)) {
      return Response.json({ error: "That group is full" }, { status: 409 });
    }

    const baseline = Number(user.total_earnings) || 0;
    const baselines = { ...(group.member_baselines || {}), [user.id]: baseline };
    const names = { ...(group.member_names || {}), [user.id]: user.full_name || "Member" };

    await base44.asServiceRole.entities.GroupGoal.update(group.id, {
      member_ids: [...members, user.id],
      member_baselines: baselines,
      member_names: names,
    });

    return Response.json({
      success: true,
      group_id: group.id,
      name: group.name,
      target_item: group.target_item,
      disclosure: GROUP_GOAL_DISCLOSURE,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
