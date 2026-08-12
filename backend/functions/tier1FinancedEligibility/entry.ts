import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { assessTier1Eligibility } from "../../sdk/tier1-financed.ts";

// tier1FinancedEligibility — read-only. Returns the gate state + this advertiser's eligibility for the
// financed ($12,000 owed, recourse) Tier 1 package. Returns "not available yet" until the program is live
// (flag ON + licensed provider + counsel sign-off). Never originates anything.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const eligibility = await assessTier1Eligibility(user as Record<string, unknown>, jurisdiction);
    return Response.json({ eligibility });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
