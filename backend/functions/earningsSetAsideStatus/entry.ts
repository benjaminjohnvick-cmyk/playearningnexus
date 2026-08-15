import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { earningsSetAsideConfig, setAsideStatus, setAsideDisclosures } from "../../sdk/earnings-setaside.ts";

// earningsSetAsideStatus (read) — the caller's set-aside preference + bucket balance + spendable balance.
// amount_owed is always 0: this is the user's own closed-loop Site Cash, re-bucketed by their own choice.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const cfg = await earningsSetAsideConfig(jurisdiction);
    if (!cfg.enabled) return Response.json({ enabled: false });
    return Response.json({
      enabled: true,
      max_pct: cfg.maxPct,
      status: setAsideStatus(user as Record<string, unknown>, cfg),
      disclosures: setAsideDisclosures(),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
