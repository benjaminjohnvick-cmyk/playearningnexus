import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { postLedgerEntry } from "../../sdk/ledger.ts";
import {
  endorserEnabled, endorserRewardSharePct, endorserMinConversionUsd, endorserDailyCapUsd, endorserPeriodCapUsd,
  endorserReward1099Reportable, endorserRewardFor, capReward, remaining,
} from "../../sdk/endorser-rewards.ts";

// endorserRewardSweep — the GATED payout for the paid-endorser program. For each pending EndorserConversion,
// it pays the member a share of the MEASURED conversion value in Site Cash — but ONLY if the post was
// #ad-disclosed and it wasn't a self-conversion, and always within the member's daily + period caps. Records
// a 1099-reportable ledger entry when configured. Credits NOTHING while ENDORSER_ENABLED is off (pending
// counsel) — it just previews what WOULD pay. Idempotent per conversion row. Admin / seed-admin service only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const enabled = endorserEnabled();
    const dryRun = body.dry_run === true || !enabled;
    const now = new Date().toISOString();
    const today = now.slice(0, 10);
    const share = endorserRewardSharePct(), minUsd = endorserMinConversionUsd();
    const dailyCap = endorserDailyCapUsd(), periodCap = endorserPeriodCapUsd();
    const reportable = endorserReward1099Reportable();

    const pending = await db.filter("EndorserConversion", { status: "pending" }, "-created_at", 3000).catch(() => []) as Record<string, unknown>[];

    // Per-member paid-so-far this day/period (from already-rewarded rows) so caps hold across sweeps.
    const rewarded = await db.filter("EndorserConversion", { status: "rewarded" }, "-created_at", 20000).catch(() => []) as Record<string, unknown>[];
    const paidDay: Record<string, number> = {}, paidPeriod: Record<string, number> = {};
    const periodStart = new Date(Date.now() - 28 * 86400000).toISOString();
    for (const r of rewarded) {
      const m = String(r.member_id); const amt = Number(r.reward_usd) || 0;
      if (String(r.day) === today) paidDay[m] = (paidDay[m] || 0) + amt;
      if (String(r.rewarded_at ?? r.created_at ?? "") >= periodStart) paidPeriod[m] = (paidPeriod[m] || 0) + amt;
    }

    const paidOut: Record<string, unknown>[] = [];
    const skipped: Record<string, unknown>[] = [];
    let total = 0;

    for (const c of pending) {
      const member = String(c.member_id);
      const gross = endorserRewardFor({
        conversion_value_usd: Number(c.conversion_value_usd) || 0,
        disclosed: c.disclosed === true, self_conversion: c.self_conversion === true, already_rewarded: false,
      }, share, minUsd);
      if (!gross.ok) { skipped.push({ id: c.id, reason: gross.reason }); continue; }

      const capd = capReward(gross.reward, remaining(dailyCap, paidDay[member] || 0), remaining(periodCap, paidPeriod[member] || 0));
      if (capd.paid <= 0) { skipped.push({ id: c.id, reason: capd.reason }); continue; }

      if (dryRun) { skipped.push({ id: c.id, member, reward: capd.paid, reason: enabled ? "would pay now" : "eligible — disabled (pending counsel)" }); continue; }

      const credited = await adjustUserBalance(member, capd.paid, { field: "points" });
      if (credited === null) { skipped.push({ id: c.id, reason: "credit failed" }); continue; }
      await postLedgerEntry({
        user_id: member, amount: capd.paid, currency: "POINTS",
        type: reportable ? "creator_payout" : "endorser_reward_sitecash",
        idempotency_key: `endorser:${c.id}`,
        meta: { conversion_ref: c.conversion_ref, post_id: c.post_id ?? null, site_cash: true, reportable_1099: reportable },
      }).catch(() => null);
      await db.update("EndorserConversion", String(c.id), { status: "rewarded", reward_usd: capd.paid, rewarded_at: now, reportable_1099: reportable, updated_at: now }).catch(() => null);
      paidDay[member] = (paidDay[member] || 0) + capd.paid;
      paidPeriod[member] = (paidPeriod[member] || 0) + capd.paid;
      total += capd.paid;
      paidOut.push({ id: c.id, member, reward: capd.paid });
    }

    return Response.json({
      ok: true, enabled, dry_run: dryRun,
      paid_count: paidOut.length, total_sitecash: Math.round(total * 100) / 100, paid: paidOut.slice(0, 100),
      skipped_count: skipped.length, skipped: skipped.slice(0, 100),
      note: enabled ? "Paid-endorser rewards are ENABLED." : "Paid-endorser program is OFF (pending counsel) — preview only; no Site Cash moved.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
