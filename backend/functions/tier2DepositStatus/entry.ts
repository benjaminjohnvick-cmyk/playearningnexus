import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { depositDeliveryStatus, depositPaidImpressions } from "../../sdk/tier2-deposit.ts";
import { tier2TermMonths } from "../../sdk/tier2-scaling.ts";

// tier2DepositStatus (read-only) — the caller's deposit delivery picture: how much of the prepaid impression
// allotment has actually been delivered, how much of the deposit is earned vs still held as unearned revenue,
// and (at term end, in refund mode) the pro-rata refund owed for anything undelivered. Never charges.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    const uid = String(user.id);

    const rows = await db.filter("Tier2ScalingPlan", { user_id: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const rec = rows[0] || null;
    if (!rec || !rec.deposit_usd) return Response.json({ has_deposit: false });

    // Delivered impressions: best-effort from the advertiser's served counter (Tier 2 members hold a seat).
    const faRows = await db.filter("FoundingAdvertiser", { user_id: uid }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    const delivered = Number(faRows[0]?.impressions_served) || 0;

    const paidImpressions = Number(rec.deposit_paid_impressions) || depositPaidImpressions(Number(rec.deposit_months) || 12);
    // Term ended if the delivery window has elapsed since the deposit was paid.
    const paidAt = Date.parse(String(rec.deposit_paid_at ?? rec.started_at ?? new Date().toISOString()));
    const monthsElapsed = Number.isFinite(paidAt) ? (Date.now() - paidAt) / (86400000 * 30) : 0;
    const termEnded = monthsElapsed >= tier2TermMonths();

    const status = depositDeliveryStatus({
      depositUsd: Number(rec.deposit_usd) || 0,
      paidImpressions,
      deliveredImpressions: delivered,
      termEnded,
    });

    return Response.json({ has_deposit: true, term_ended: termEnded, deposit: status });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
