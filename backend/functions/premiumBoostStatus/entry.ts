import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { premiumBoostConfig, memberGrant, poolAvailableUsd, premiumBoostStatus, premiumBoostDisclosures } from "../../sdk/premium-boost.ts";

// premiumBoostStatus (read) — the caller's advertiser-funded boost: eligibility (premium), how much they've
// claimed/used, their unspent boost credit, how much more they can claim, and the pool availability.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const cfg = await premiumBoostConfig((user as Record<string, unknown>).jurisdiction as string | null ?? null);
    if (!cfg.enabled) return Response.json({ enabled: false });
    const [grant, pool] = await Promise.all([memberGrant(String(user.id)), poolAvailableUsd()]);
    return Response.json({
      enabled: true,
      status: premiumBoostStatus(user as Record<string, unknown>, grant, pool, cfg),
      disclosures: premiumBoostDisclosures(cfg),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
