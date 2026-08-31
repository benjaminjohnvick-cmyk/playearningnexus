import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { postLedgerEntry } from "../../sdk/ledger.ts";
import { advanceEnabled, advanceRecoupPct, advanceYearEndForgive, recoupFromEarnings, forgiveRemaining } from "../../sdk/advance.ts";

// advanceRecoupSweep — the GATED recoupment. For each outstanding Advance, applies a share (ADVANCE_RECOUP_PCT)
// of the member's rewards earned since the last sweep to the outstanding balance — the member still keeps the
// rest, so recoupment never zeroes their earning. When a member's term ends and forgiveness is on, any
// remaining balance is FORGIVEN (non-recourse — never collected, never a debt) and their prior-recoupment count
// is credited (track record). Recoups NOTHING while ADVANCE_ENABLED is off (preview only). Admin / seed-admin.
//
// NOTE: recoupment reduces what is PAID OUT of the member's freshly-earned rewards toward the advance they
// already received — it does NOT claw back existing balance and can never push a member negative (the earnings
// were the advance in the first place). Non-recourse throughout.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const enabled = advanceEnabled();
    const dryRun = body.dry_run === true || !enabled;
    const pct = advanceRecoupPct();
    const now = new Date().toISOString();
    const limit = Math.max(1, Math.min(5000, Number(body.limit) || 2000));

    const open = await db.filter("Advance", { status: "outstanding" }, "-created_at", limit).catch(() => []) as Record<string, unknown>[];

    const recouped: Record<string, unknown>[] = [];
    const forgiven: Record<string, unknown>[] = [];
    let totalRecoup = 0, totalForgive = 0;

    for (const a of open) {
      const id = String(a.id);
      const memberId = String(a.member_id);
      const outstanding = Math.max(0, Number(a.outstanding_usd) || 0);

      // Term end → forgive remainder (non-recourse).
      const termEnded = body.force_term_end === true || (a.term_ends_at && String(a.term_ends_at) <= now);
      if (termEnded && advanceYearEndForgive() && outstanding > 0) {
        if (dryRun) { forgiven.push({ advance_id: id, would_forgive: outstanding, reason: enabled ? "would forgive now" : "disabled (pending counsel)" }); continue; }
        const f = forgiveRemaining(outstanding);
        await db.update("Advance", id, { outstanding_usd: 0, forgiven_usd: (Number(a.forgiven_usd) || 0) + f.forgiven, status: "forgiven", updated_at: now }).catch(() => null);
        await db.update("User", memberId, { advance_outstanding_usd: 0, advance_active_id: null, advances_repaid: (Number((await db.get("User", memberId).catch(() => ({})) as Record<string, unknown>).advances_repaid) || 0) + 1, updated_at: now }).catch(() => null);
        totalForgive += f.forgiven; forgiven.push({ advance_id: id, forgiven: f.forgiven }); continue;
      }

      // Recoup from rewards earned since last sweep (caller supplies per-member earned map, else 0).
      const earned = Math.max(0, Number((body.earned_by_member || {})[memberId]) || 0);
      const r = recoupFromEarnings(outstanding, earned, pct);
      if (r.recoup <= 0) continue;
      if (dryRun) { recouped.push({ advance_id: id, would_recoup: r.recoup, reason: enabled ? "would recoup now" : "disabled (pending counsel)" }); continue; }

      const nowOut = r.newOutstanding;
      const cleared = nowOut <= 0;
      await db.update("Advance", id, {
        outstanding_usd: nowOut, recouped_usd: (Number(a.recouped_usd) || 0) + r.recoup,
        status: cleared ? "recouped" : "outstanding", updated_at: now,
      }).catch(() => null);
      const um = await db.get("User", memberId).catch(() => ({})) as Record<string, unknown>;
      await db.update("User", memberId, {
        advance_outstanding_usd: nowOut,
        advance_active_id: cleared ? null : id,
        advances_repaid: cleared ? (Number(um.advances_repaid) || 0) + 1 : (Number(um.advances_repaid) || 0),
        updated_at: now,
      }).catch(() => null);
      await postLedgerEntry({
        user_id: memberId, amount: r.recoup, currency: "POINTS", type: "advance_recoup",
        idempotency_key: `advance:recoup:${id}:${now.slice(0,10)}`,
        meta: { site_cash: true, advance_id: id, cleared },
      }).catch(() => null);
      totalRecoup += r.recoup; recouped.push({ advance_id: id, recoup: r.recoup, cleared });
    }

    return Response.json({
      ok: true, enabled, dry_run: dryRun,
      recouped_count: recouped.length, total_recoup_usd: Math.round(totalRecoup * 100) / 100, recouped: recouped.slice(0, 100),
      forgiven_count: forgiven.length, total_forgiven_usd: Math.round(totalForgive * 100) / 100, forgiven: forgiven.slice(0, 100),
      note: enabled ? "Non-recourse recoupment from earned rewards." : "Advance is OFF (pending counsel) — preview only; nothing recouped or forgiven.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
