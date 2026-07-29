import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { memberStamp } from "../../sdk/household.ts";

// householdSetLimit (holder only) — set a teen member's per-order auto-approve limit. Orders at/under
// the limit skip approval; anything above still needs the holder's sign-off. 0 = approve every order.
// Body: { member_user_id, spend_limit_usd }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { member_user_id, spend_limit_usd } = await req.json().catch(() => ({}));
    if (!member_user_id) return Response.json({ error: "member_user_id required" }, { status: 400 });

    const [household] = await base44.asServiceRole.entities.Household.filter({ holder_id: user.id });
    if (!household) return Response.json({ error: "Only the account holder can set limits." }, { status: 403 });

    const members = Array.isArray(household.members) ? household.members : [];
    const idx = members.findIndex((m: any) => m.user_id === member_user_id && m.status === "active");
    if (idx < 0) return Response.json({ error: "That member isn't in your household." }, { status: 404 });
    if (members[idx].role !== "teen") return Response.json({ error: "Limits only apply to teen members." }, { status: 400 });

    const limit = Math.max(0, Number(spend_limit_usd) || 0);
    members[idx] = { ...members[idx], spend_limit_usd: limit };
    await base44.asServiceRole.entities.Household.update(household.id, { members });
    await base44.asServiceRole.entities.User.update(member_user_id, memberStamp(household.id, user.id, "teen", limit));

    return Response.json({ ok: true, member_user_id, spend_limit_usd: limit });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
