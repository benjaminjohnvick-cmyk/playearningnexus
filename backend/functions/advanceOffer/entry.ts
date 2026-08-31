import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  advanceEnabled, advancePremiumOnly, advanceMinEarnHistoryUsd, advanceMinAccountDays,
  advanceFirstCapUsd, advanceMaxUsd, advanceRecoupPct, advanceEligible, maxAdvanceFor, advanceDisclosure,
} from "../../sdk/advance.ts";

// advanceOffer — read-only: tells the signed-in member whether they qualify for a purchasing-power advance and,
// if so, how much (graduated by their recoupment track record), with the honest disclosure. Moves nothing.
// Reports enabled=false while the advance is gated off (pending counsel).
function isPremium(u: Record<string, unknown>): boolean {
  return u.is_premium === true || u.premium === true || String(u.membership_tier ?? "").toLowerCase() === "premium";
}
function accountDays(u: Record<string, unknown>): number {
  const c = u.created_date ? new Date(String(u.created_date)).getTime() : Date.now();
  return Math.max(0, Math.floor((Date.now() - c) / 86400000));
}
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const u = user as Record<string, unknown>;

    const member = {
      isPremium: isPremium(u),
      earnHistoryUsd: Math.max(0, Number(u.total_earnings) || Number(u.lifetime_earnings) || 0),
      accountDays: accountDays(u),
      advancesRepaid: Math.max(0, Number(u.advances_repaid) || 0),
      outstandingUsd: Math.max(0, Number(u.advance_outstanding_usd) || 0),
      suspended: u.suspended === true || u.status === "suspended",
    };
    const gate = advanceEligible(member, {
      premiumOnly: advancePremiumOnly(), minEarnHistory: advanceMinEarnHistoryUsd(), minAccountDays: advanceMinAccountDays(),
    });
    const amount = gate.eligible ? maxAdvanceFor(member, { firstCap: advanceFirstCapUsd(), maxCap: advanceMaxUsd() }) : 0;

    return Response.json({
      ok: true, enabled: advanceEnabled(),
      eligible: gate.eligible, reason: gate.reason,
      offer_usd: amount, recoup_pct: advanceRecoupPct(),
      outstanding_usd: member.outstandingUsd,
      disclosure: amount > 0 ? advanceDisclosure(amount, advanceRecoupPct()) : null,
      note: advanceEnabled()
        ? "Free, non-recourse — recouped only from future rewards; any shortfall is forgiven."
        : "Advance is OFF (pending counsel) — this is a preview of what you'd qualify for; nothing is granted.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
