import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { postLedgerEntry } from "../../sdk/ledger.ts";
import {
  advanceEnabled, advancePremiumOnly, advanceMinEarnHistoryUsd, advanceMinAccountDays,
  advanceFirstCapUsd, advanceMaxUsd, advanceEligible, maxAdvanceFor,
} from "../../sdk/advance.ts";

// advanceGrant — the GATED grant. For an eligible member, fronts store credit (Site Cash / points) up to the
// amount they qualify for, records an Advance row (status "outstanding"), and stamps the member's outstanding
// balance. FREE — no fee, no interest is added. Idempotent per member while an advance is outstanding. Grants
// NOTHING while ADVANCE_ENABLED is off (preview only). Admin / seed-admin service (called by the member-facing
// "take advance" flow, which re-checks consent).
function isPremium(u: Record<string, unknown>): boolean {
  return u.is_premium === true || u.premium === true || String(u.membership_tier ?? "").toLowerCase() === "premium";
}
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const memberId = String(body.member_id ?? "");
    if (!memberId) return Response.json({ error: "member_id is required." }, { status: 400 });
    const enabled = advanceEnabled();
    const dryRun = body.dry_run === true || !enabled;

    const u = await db.get("User", memberId).catch(() => null) as Record<string, unknown> | null;
    if (!u) return Response.json({ error: "member not found" }, { status: 404 });
    const c = u.created_date ? new Date(String(u.created_date)).getTime() : Date.now();
    const member = {
      isPremium: isPremium(u),
      earnHistoryUsd: Math.max(0, Number(u.total_earnings) || Number(u.lifetime_earnings) || 0),
      accountDays: Math.max(0, Math.floor((Date.now() - c) / 86400000)),
      advancesRepaid: Math.max(0, Number(u.advances_repaid) || 0),
      outstandingUsd: Math.max(0, Number(u.advance_outstanding_usd) || 0),
      suspended: u.suspended === true || u.status === "suspended",
    };
    const gate = advanceEligible(member, {
      premiumOnly: advancePremiumOnly(), minEarnHistory: advanceMinEarnHistoryUsd(), minAccountDays: advanceMinAccountDays(),
    });
    if (!gate.eligible) return Response.json({ ok: true, granted: false, reason: gate.reason });

    const requested = Math.max(0, Number(body.amount_usd) || 0);
    const qualified = maxAdvanceFor(member, { firstCap: advanceFirstCapUsd(), maxCap: advanceMaxUsd() });
    const amount = Math.round(Math.min(qualified, requested || qualified) * 100) / 100;
    if (amount <= 0) return Response.json({ ok: true, granted: false, reason: "no advance amount available" });

    if (dryRun) {
      return Response.json({ ok: true, enabled, dry_run: true, would_grant_usd: amount, reason: enabled ? "would grant now" : "eligible — disabled (pending counsel)" });
    }

    const now = new Date().toISOString();
    const credited = await adjustUserBalance(memberId, amount, { field: "points" });   // front store credit
    if (credited === null) return Response.json({ ok: false, reason: "credit failed" });
    const row = await db.create("Advance", {
      member_id: memberId, amount_usd: amount, outstanding_usd: amount, recouped_usd: 0, forgiven_usd: 0,
      status: "outstanding", free: true, non_recourse: true, granted_at: now, term_ends_at: null,
      created_at: now, updated_at: now,
    }).catch(() => null) as Record<string, unknown> | null;
    await db.update("User", memberId, { advance_outstanding_usd: amount, advance_active_id: row?.id ?? null, updated_at: now }).catch(() => null);
    await postLedgerEntry({
      user_id: memberId, amount, currency: "POINTS", type: "advance_grant",
      idempotency_key: `advance:grant:${row?.id ?? memberId}:${now.slice(0,10)}`,
      meta: { site_cash: true, free: true, non_recourse: true, advance_id: row?.id ?? null },
    }).catch(() => null);

    return Response.json({ ok: true, enabled, granted: true, advance_id: row?.id ?? null, amount_usd: amount, note: "Free, non-recourse store-credit advance granted." });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
