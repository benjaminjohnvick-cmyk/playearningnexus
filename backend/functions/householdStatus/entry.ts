import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { teenAccountsEnabled } from "../../sdk/household.ts";

// householdStatus (authenticated) — everything the Family & Teens page needs for the caller:
//   • holder → the household, its active members, and the orders awaiting their approval;
//   • member → the household they belong to and their role;
//   • nobody → { in_household:false } so the page can offer to create one.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const teen_enabled = await teenAccountsEnabled();

    // Holder view.
    const [owned] = await base44.asServiceRole.entities.Household.filter({ holder_id: user.id });
    if (owned) {
      const members = (Array.isArray(owned.members) ? owned.members : []).filter((m: any) => m.status === "active");
      const pending = await base44.asServiceRole.entities.Order.filter({ approver_id: user.id, status: "pending_approval" }, "-created_at", 50).catch(() => []);
      return Response.json({
        in_household: true, is_holder: true, teen_enabled,
        household: { id: owned.id, name: owned.name, holder_id: owned.holder_id, members }, pending_approvals: pending || [],
      });
    }

    // Member view.
    if (user.household_id) {
      const household = await base44.asServiceRole.entities.Household.filter({ id: user.household_id }).then((r: any) => r[0]).catch(() => null);
      const members = household && Array.isArray(household.members) ? household.members.filter((m: any) => m.status === "active") : [];
      return Response.json({
        in_household: true, is_holder: false, teen_enabled,
        role: user.household_role || "adult", spend_limit_usd: Number(user.household_spend_limit_usd) || 0,
        household: household ? { id: household.id, name: household.name, members } : null,
      });
    }

    return Response.json({ in_household: false, teen_enabled });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
