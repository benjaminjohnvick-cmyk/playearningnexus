import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import { paypalBusinessEmail, paymentsProvider } from "../../sdk/paypal.ts";

// profitSummary (INTERNAL/ADMIN) — the plain "what's my profit" view: money IN vs money OUT over a window,
// routed through PayPal, plus the RevenueEvent business-revenue and Expense ledgers. profit = in − out. This
// is the simple admin number; the Growth Engine adds the reserve-aware "what's safe to spend" layer.
export default __handler(async (req) => {
  const denied = await requireInternalOrAdmin(req);
  if (denied) return denied;
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const days = Math.max(1, Math.min(3650, Math.round(Number(body.days) || 30)));
    const cutoffMs = Date.now() - days * 86400000;
    const inWin = (r: Record<string, unknown>) => {
      const at = r.at ? new Date(String(r.at)).getTime() : (r.created_date ? new Date(String(r.created_date)).getTime() : 0);
      return !at || at >= cutoffMs;
    };

    // Money flows (PayPal in/out) from the immutable ledger.
    const flows = await base44.asServiceRole.entities.MoneyLedgerEntry.filter({}, "-created_date", 20000).catch(() => []) as Record<string, unknown>[];
    let moneyIn = 0, moneyOut = 0;
    const inByKind: Record<string, number> = {}, outByKind: Record<string, number> = {};
    for (const f of (flows || [])) {
      if (!inWin(f)) continue;
      const amt = Number(f.amount_usd) || 0;
      if (f.direction === "out") { moneyOut += amt; outByKind[String(f.kind)] = Math.round(((outByKind[String(f.kind)] || 0) + amt) * 100) / 100; }
      else { moneyIn += amt; inByKind[String(f.kind)] = Math.round(((inByKind[String(f.kind)] || 0) + amt) * 100) / 100; }
    }

    // Business revenue + subsidies (RevenueEvent) and expenses.
    const events = await base44.asServiceRole.entities.RevenueEvent.filter({}, "-created_date", 20000).catch(() => []) as Record<string, unknown>[];
    let revenue = 0, subsidies = 0;
    for (const e of (events || [])) { if (!inWin(e)) continue; const amt = Number(e.amount_usd) || 0; if (e.kind === "subsidy") subsidies += amt; else revenue += amt; }
    const expenses = await base44.asServiceRole.entities.Expense.filter({}, "-created_date", 20000).catch(() => []) as Record<string, unknown>[];
    let expense = 0;
    for (const x of (expenses || [])) { if (!inWin(x)) continue; expense += Number(x.amount_usd) || 0; }

    const totalIn = Math.round((moneyIn + revenue) * 100) / 100;
    const totalOut = Math.round((moneyOut + subsidies + expense) * 100) / 100;
    const profit = Math.round((totalIn - totalOut) * 100) / 100;

    return Response.json({
      window_days: days,
      provider: paymentsProvider(),
      paypal_business_email: paypalBusinessEmail() || null,
      money_in_usd: Math.round(moneyIn * 100) / 100,
      money_out_usd: Math.round(moneyOut * 100) / 100,
      business_revenue_usd: Math.round(revenue * 100) / 100,
      subsidies_usd: Math.round(subsidies * 100) / 100,
      expenses_usd: Math.round(expense * 100) / 100,
      total_in_usd: totalIn,
      total_out_usd: totalOut,
      profit_usd: profit,
      in_by_kind: inByKind,
      out_by_kind: outByKind,
      note: "profit = (PayPal money-in + business revenue) − (PayPal money-out + subsidies + expenses). See the Growth Engine for the reserve-aware amount that's actually safe to withdraw. Live PayPal capture/payout runs under your connected credentials — the app records the flows.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
