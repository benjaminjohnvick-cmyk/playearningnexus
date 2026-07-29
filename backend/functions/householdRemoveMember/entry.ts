import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { clearStamp } from "../../sdk/household.ts";

// householdRemoveMember (holder only) — remove a member from the household. The holder can't remove
// themselves (dissolving a household is a separate action). Body: { member_user_id }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { member_user_id } = await req.json().catch(() => ({}));
    if (!member_user_id) return Response.json({ error: "member_user_id required" }, { status: 400 });
    if (member_user_id === user.id) return Response.json({ error: "The account holder can't be removed." }, { status: 400 });

    const [household] = await base44.asServiceRole.entities.Household.filter({ holder_id: user.id });
    if (!household) return Response.json({ error: "Only the account holder can remove members." }, { status: 403 });

    const members = Array.isArray(household.members) ? household.members : [];
    const idx = members.findIndex((m: any) => m.user_id === member_user_id && m.status === "active");
    if (idx < 0) return Response.json({ error: "That member isn't in your household." }, { status: 404 });

    members[idx] = { ...members[idx], status: "removed", removed_at: new Date().toISOString() };
    await base44.asServiceRole.entities.Household.update(household.id, { members });
    await base44.asServiceRole.entities.User.update(member_user_id, clearStamp());
    await base44.asServiceRole.entities.Notification.create({
      user_id: member_user_id, type: "household_removed",
      title: "👋 Removed from household", message: "You were removed from your household. Your account is now independent.", is_read: false,
    }).catch(() => null);

    return Response.json({ ok: true, removed: member_user_id });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
