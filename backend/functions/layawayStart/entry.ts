import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { startLayaway } from "../../sdk/layaway.ts";

// layawayStart (authenticated) — reserve a physical item and open a layaway plan the buyer pays down
// with earned points BEFORE it ships (no credit extended). Required monthly is capped at
// LAYAWAY_MAX_MONTHLY_USD (default $90). Body: { listing_id }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const { listing_id } = await req.json().catch(() => ({}));
    if (!listing_id) return Response.json({ error: "listing_id required" }, { status: 400 });
    const r = await startLayaway(user.id, listing_id);
    if ((r as any).error) return Response.json(r, { status: 400 });
    return Response.json(r);
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
