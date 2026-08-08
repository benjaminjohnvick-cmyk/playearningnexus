import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { advanceConfig, earnHistory, project } from "../../sdk/goods-advance.ts";

// goodsAdvanceTracker — informational repayment projection for the member's active advance.
// Encouragement only; never penalizes. Non-recourse: nothing is owed in cash.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const cfg = await advanceConfig((user as Record<string, unknown>).jurisdiction as string | null ?? null);
    const rows = await db.filter("GoodsAdvance", { user_id: user.id, status: "active" }, "-created_date", 1);
    const adv = rows[0] as Record<string, unknown> | undefined;
    if (!adv) {
      return Response.json({ success: true, active: null, config: { capUsd: cfg.capUsd, termMonths: cfg.termMonths, aprPct: cfg.aprPct, nonRecourse: cfg.nonRecourse } });
    }
    const hist = await earnHistory(user.id);
    const proj = project(Number(adv.principal_usd ?? 0), Number(adv.repaid_usd ?? 0), hist.avgDailyUsd, cfg.termMonths);
    return Response.json({ success: true, active: { id: adv.id, ...proj } });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
