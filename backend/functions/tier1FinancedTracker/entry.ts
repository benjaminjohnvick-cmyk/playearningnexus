import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { tier1FinancedConfig, activeTier1Plan, projectTier1 } from "../../sdk/tier1-financed.ts";
import { earnHistory } from "../../sdk/goods-advance.ts";

// tier1FinancedTracker — read-only. If the advertiser has an active financed plan, returns its balance and a
// projection of the term-end position (including any cash shortfall that would remain OWED, since this is
// recourse). Informational only — no billing, no charge.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const jurisdiction = (user as Record<string, unknown>).jurisdiction as string | null ?? null;
    const cfg = await tier1FinancedConfig(jurisdiction);
    const plan = await activeTier1Plan(String(user.id));
    if (!plan) return Response.json({ active: null });
    const hist = await earnHistory(String(user.id));
    const principal = Number((plan as Record<string, unknown>).principal_usd) || cfg.principalUsd;
    const swept = Number((plan as Record<string, unknown>).swept_usd) || 0;
    const projection = projectTier1(principal, swept, hist.avgDailyUsd, { termMonths: cfg.termMonths, sweepPct: cfg.sweepPct, recourse: cfg.recourse });
    return Response.json({ active: projection });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
