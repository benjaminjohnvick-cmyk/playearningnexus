import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { assessEligibility } from "../../sdk/goods-advance.ts";

// goodsAdvanceEligibility — read-only: is the Goods Advance available to this member, and for how much?
// Safe to call anytime; returns available:false with a reason when the program is off or the member
// doesn't yet qualify (ability-to-repay). Never originates anything.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const eligibility = await assessEligibility(user as Record<string, unknown>, jurisdiction);
    return Response.json({ success: true, eligibility });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
