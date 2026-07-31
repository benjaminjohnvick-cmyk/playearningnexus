import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { breakageRecognitionPct, pointValueUsd } from "../../sdk/revenue.ts";
import { db } from "../../sdk/db.ts";

// revenueReport (INTERNAL/ADMIN) — the single source of truth across every non-customer revenue stream.
// Sums the RevenueEvent ledger by type over a window, adds an estimated BREAKAGE figure (B14: outstanding
// closed-loop points assumed never redeemed × recognition rate), and proves the invariant that NONE of it
// is a customer markup.
//   Body: { days?: number }  → totals by type + grand total + breakage estimate
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(3650, Math.round(Number(body.days) || 30)));
    const cutoffMs = Date.now() - days * 86400000;

    const rows = await base44.asServiceRole.entities.RevenueEvent.filter({}, "-created_date", 20000).catch(() => []) as Record<string, unknown>[];
    const byType: Record<string, number> = {};
    let total = 0, customerPaid = 0;
    for (const r of (rows || [])) {
      const at = r.at ? new Date(String(r.at)).getTime() : (r.created_date ? new Date(String(r.created_date)).getTime() : 0);
      if (at && at < cutoffMs) continue;
      const amt = Number(r.amount_usd) || 0;
      byType[String(r.type)] = Math.round(((byType[String(r.type)] || 0) + amt) * 100) / 100;
      total += amt;
      if (r.customer_paid === true) customerPaid += amt;   // should always be 0 — the invariant
    }

    // B14 — breakage estimate from OUTSTANDING closed-loop points (bounded scan; report-only estimate).
    const users = await base44.asServiceRole.entities.User.filter({}, undefined, 50000).catch(() => []) as Record<string, unknown>[];
    let outstandingPoints = 0;
    for (const u of (users || [])) outstandingPoints += Number(u.points) || 0;
    const breakageUsd = Math.round(outstandingPoints * pointValueUsd() * breakageRecognitionPct() * 100) / 100;

    return Response.json({
      window_days: days,
      by_type: byType,
      recorded_total_usd: Math.round(total * 100) / 100,
      breakage_estimate_usd: breakageUsd,
      grand_total_incl_breakage_usd: Math.round((total + breakageUsd) * 100) / 100,
      customer_paid_usd: Math.round(customerPaid * 100) / 100,   // invariant: expect 0 (no customer markup)
      invariant_ok: customerPaid === 0,
      note: "All figures are business-side / structural revenue. customer_paid_usd must be 0 — customers are never charged a markup.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
