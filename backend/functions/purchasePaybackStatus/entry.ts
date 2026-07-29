import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { getNumber } from "../../sdk/settings.ts";
import { isEnabled } from "../../sdk/feature-flags.ts";

// purchasePaybackStatus (authenticated) — the "earn it back" TRACKER. It shows how much real money the
// user has spent (card/BNPL orders) and how much they've EARNED so far (in closed-loop points they can
// spend on-platform), as progress toward "earning back" what they spent.
//
// IMPORTANT — what this is and isn't: the platform lends NOTHING and gives NO money upfront. The user
// pays with their own card; this is purely a motivational progress tracker showing points they've
// genuinely earned. It is FACTUAL (already-earned vs already-spent), not a projection or a promise —
// how much someone earns back always depends on their own activity. We never state a guaranteed payback.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!(await isEnabled("purchase_payback").catch(() => true))) return Response.json({ ok: true, enabled: false });

    // Real cash spent = orders paid with card or Affirm (not points/layaway — those cost no cash), that
    // weren't refunded/cancelled.
    const orders = await base44.asServiceRole.entities.Order.filter({ user_id: user.id }).catch(() => []) as any[];
    const cashMethods = new Set(["card", "affirm", "credit_card", "bnpl"]);
    const spent = orders
      .filter((o) => cashMethods.has(String(o.payment_method || "")) && !["refunded", "cancelled", "canceled"].includes(String(o.status || "")))
      .reduce((s, o) => s + (Number(o.amount) || 0), 0);

    // Earned so far = the user's cumulative earnings (closed-loop value they can spend on-platform).
    const earned = Number(user.total_earnings) || 0;

    const spentR = Math.round(spent * 100) / 100;
    const earnedBack = Math.round(Math.min(earned, spentR) * 100) / 100; // capped at what was spent (a tracker toward zero net)
    const remaining = Math.round(Math.max(0, spentR - earned) * 100) / 100;
    const pct = spentR > 0 ? Math.round((earnedBack / spentR) * 100) : 0;
    const yearLimit = await getNumber("PHYSICAL_AFFORDABILITY_LIMIT_USD", 1460);

    return Response.json({
      ok: true,
      enabled: true,
      spent_usd: spentR,
      earned_usd: Math.round(earned * 100) / 100,
      earned_back_usd: earnedBack,
      remaining_usd: remaining,
      progress_pct: pct,
      reasonable_annual_earn_usd: yearLimit,
      // Honest, non-guaranteeing copy for the UI to show verbatim.
      disclosure: "This tracks points you've actually earned toward what you've spent. It isn't a loan or a promise — how much you earn back depends on your own activity.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
