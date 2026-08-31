import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { postLedgerEntry } from "../../sdk/ledger.ts";
import {
  usageFeeEnabled, usageFeeDailyUsd, usageFeeCapUsd, usageFeeCapPeriodDays, computeUsageFee,
} from "../../sdk/usage-fee.ts";

// usageFeeApply — the GATED daily job that charges the uniform usage fee. For each active user it charges ONLY
// from AVAILABLE earned rewards (the `points` / Site Cash field), never more than is available (NO DEBT — a
// user can never owe), never past the cap, and once per day (idempotent per user+day). Records a ledger entry
// and tracks cumulative paid + the cap-window start. Moves NOTHING while USAGE_FEE_ENABLED is off — it just
// previews what WOULD be charged. Admin / seed-admin service only (wire to the scheduler when enabled).
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const enabled = usageFeeEnabled();
    const dryRun = body.dry_run === true || !enabled;      // never moves money while disabled
    const feeUsd = usageFeeDailyUsd();
    const capUsd = usageFeeCapUsd();
    const periodDays = usageFeeCapPeriodDays();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const limit = Math.max(1, Math.min(5000, Number(body.limit) || 2000));

    const users = await db.filter("User", {}, "-created_date", limit).catch(() => []) as Record<string, unknown>[];

    const charged: Record<string, unknown>[] = [];
    const skipped: Record<string, unknown>[] = [];
    let total = 0;

    for (const u of users) {
      const uid = String(u.id);
      if (String(u.usage_fee_last_day ?? "") === today) { skipped.push({ id: uid, reason: "already charged today" }); continue; }

      // Reset the cap window if the period elapsed (0 = lifetime, never resets).
      let paidToDate = Math.max(0, Number(u.usage_fee_paid_usd) || 0);
      const windowStart = String(u.usage_fee_window_start ?? "");
      let newWindowStart = windowStart || today;
      if (periodDays > 0 && windowStart) {
        const ageDays = (now.getTime() - new Date(windowStart).getTime()) / 86400000;
        if (ageDays >= periodDays) { paidToDate = 0; newWindowStart = today; }
      }

      // Available earned rewards = the points/Site Cash balance. Never deduct more than this (no debt).
      const available = Math.max(0, Number(u.points) || 0);
      const res = computeUsageFee({ feeUsd, earnedAvailableUsd: available, paidToDateUsd: paidToDate, capUsd });
      if (res.fee <= 0) { skipped.push({ id: uid, reason: res.reason }); continue; }

      if (dryRun) { skipped.push({ id: uid, would_charge: res.fee, reason: enabled ? "would charge now" : "eligible — disabled (pending counsel)" }); continue; }

      const credited = await adjustUserBalance(uid, -res.fee, { field: "points" });
      if (credited === null) { skipped.push({ id: uid, reason: "deduct failed" }); continue; }
      await postLedgerEntry({
        user_id: uid, amount: res.fee, currency: "POINTS", type: "usage_fee",
        idempotency_key: `usagefee:${uid}:${today}`,
        meta: { site_cash: true, day: today, from_earnings: true },
      }).catch(() => null);
      await db.update("User", uid, {
        usage_fee_paid_usd: Math.round((paidToDate + res.fee) * 100) / 100,
        usage_fee_last_day: today, usage_fee_window_start: newWindowStart,
      }).catch(() => null);
      total += res.fee;
      charged.push({ id: uid, fee: res.fee });
    }

    return Response.json({
      ok: true, enabled, dry_run: dryRun,
      charged_count: charged.length, total_usd: Math.round(total * 100) / 100, charged: charged.slice(0, 100),
      skipped_count: skipped.length, skipped: skipped.slice(0, 50),
      note: enabled ? "Uniform usage fee charged from earned rewards (never a debt)." : "Usage fee is OFF (pending counsel) — preview only; nothing charged.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
