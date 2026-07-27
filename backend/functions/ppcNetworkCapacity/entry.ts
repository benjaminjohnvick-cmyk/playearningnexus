import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { PPC_GRID_ANNUAL_PRICE } from "../../sdk/premium-ppc.ts";

// ppcNetworkCapacity — how many users the PPC earning network can hold, computed 1:1 from the number
// of BUSINESSES that have paid the $5,000 grid price. One user slot per paying business.
//   capacity  = paying businesses (ppc_grid_active)
//   used      = active matched memberships
//   available = capacity - used
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const businesses = await base44.asServiceRole.entities.User.filter({ ppc_grid_active: true });
    const capacity = (businesses || []).length; // 1:1 — one user slot per paying business

    const memberships = await base44.asServiceRole.entities.PremiumPPCMembership.list("-created_date", 10000);
    const used = new Set((memberships || [])
      .filter((m: Record<string, unknown>) => m.status === "active" || m.status === "ceiling_reached")
      .map((m: Record<string, unknown>) => m.advertiser_user_id)).size;

    return Response.json({
      grid_price: PPC_GRID_ANNUAL_PRICE,
      paying_businesses: capacity,
      capacity,                       // 1:1 ratio
      used,
      available: Math.max(0, capacity - used),
      ratio: "1:1 (one user per paying business)",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
