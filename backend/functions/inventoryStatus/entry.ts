import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { inventoryStatus, inventoryGovernorEnabled } from "../../sdk/inventory-governor.ts";

// inventoryStatus (admin, read) — the live ad-inventory picture: DAU-derived annual capacity, what's committed
// to active advertisers, remaining headroom, and how many more Tier 1 / Tier 2 seats can be sold without
// overselling. Use it to size how many advertisers your current audience can actually carry.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== "admin") return Response.json({ error: "Admin only" }, { status: 403 });

    const status = await inventoryStatus();
    return Response.json({
      governor_enabled: await inventoryGovernorEnabled(),
      inventory: status,
      note: "Capacity = DAU × impressions/user/day × 365 × (1 − safety buffer). Sales are blocked once committed " +
        "allotments would exceed capacity, so promised impressions are always deliverable.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
