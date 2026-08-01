import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { isMember } from "../../sdk/group.ts";
import { burstDailyGoalUsd } from "../../sdk/burst.ts";

// groupStatus (authenticated) — the group's members with today's progress, size, and status. Membership-only.
//   Body: { session_id }  → { size, status, members:[{display_name, earned_today, is_me}] }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const session = await db.get("GroupSession", String(body.session_id || "")).catch(() => null) as Record<string, unknown> | null;
    if (!session) return Response.json({ error: "Not found" }, { status: 404 });
    if (!isMember(session, user.id)) return Response.json({ error: "Not your group." }, { status: 403 });

    const today = new Date().toISOString().slice(0, 10);
    const goal = burstDailyGoalUsd();
    const memberIds = (session.members as string[] || []).map(String);
    const members = [];
    for (const mid of memberIds) {
      const u = await base44.asServiceRole.entities.User.filter({ id: mid }).then((r: any) => r[0]).catch(() => null);
      const e = await db.filter("DailyEarnings", { user_id: mid, date: today }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
      members.push({
        user_id: mid,
        display_name: mid === user.id ? "You" : (u?.full_name ? String(u.full_name).split(" ")[0] : "Member"),
        is_me: mid === user.id,
        earned_today: Number(e?.[0]?.survey_gross) || Number(e?.[0]?.total_earned) || 0,
        goal_usd: goal,
      });
    }

    return Response.json({ session_id: session.id, size: session.size, status: session.status, topic: session.topic || null, members });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
