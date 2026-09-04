import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { revenueLeversRegistryEnabled, REVENUE_LEVERS, summarizeLevers, CATEGORY_NAMES, leverConfiguredOn } from "../../sdk/revenue-levers.ts";

// revenueLeversStatus (admin) — the governance view of every monetization sub-point across all 8 categories:
// each lever's status (built / gated / counsel), what it books to, what it's gated by, and (for gated) what
// external account it still needs. Also totals live REVENUE by ledger type from the RevenueEvent ledger so the
// admin can see which built levers are actually earning. Read-only; never changes any gate.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user && user.role !== "admin") return Response.json({ error: "Admin only." }, { status: 403 });
    if (!revenueLeversRegistryEnabled()) return Response.json({ enabled: false, categories: {}, totals: {} });

    const summary = summarizeLevers();

    // Which gated/counsel levers has the admin switched ON in the wizard (still awaiting account/counsel to earn).
    const configuredOn: Record<string, boolean> = {};
    for (const l of REVENUE_LEVERS) if (l.enable_flag) configuredOn[l.key] = leverConfiguredOn(l);

    // Best-effort: total earned revenue per ledger type (money-in only), so "built" levers show real earnings.
    const earnedByType: Record<string, number> = {};
    try {
      const evs = await db.filter("RevenueEvent", { kind: "revenue" }, "-created_date", 5000) as Record<string, unknown>[];
      for (const e of evs || []) {
        const t = String(e.type || "other");
        earnedByType[t] = Math.round(((earnedByType[t] || 0) + (Number(e.amount_usd) || 0)) * 100) / 100;
      }
    } catch { /* ledger not readable — status still returns without earnings */ }

    return Response.json({
      enabled: true,
      category_names: CATEGORY_NAMES,
      totals: summary.totals,
      categories: summary.categories,
      levers: REVENUE_LEVERS,
      configured_on: configuredOn,
      earned_by_ledger_type: earnedByType,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
