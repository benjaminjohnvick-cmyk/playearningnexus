import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { postLedgerEntry } from "../../sdk/ledger.ts";
import { referralTiersEnabled, referralAdvertiserClawbackDays, referralBonus1099Reportable, advertiserBonusEligible, userBonusEligible } from "../../sdk/referral-tiers.ts";

// referralBonusSweep — the GATED payout. Scans pending ReferralBonus rows and credits Site Cash to the
// referrer for the ones that are now eligible: a USER referral once active; an ADVERTISER referral only after
// its payment cleared AND the clawback window elapsed AND it wasn't refunded/charged-back. Idempotent (per
// bonus row + ledger idempotency key). Records a 1099-reportable ledger entry when configured. Credits
// NOTHING while REFERRAL_TIERS_ENABLED is off (pending counsel) — it just reports what WOULD pay (dry run).
// Admin / seed-admin service only.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden (admin only)." }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const enabled = referralTiersEnabled();
    const dryRun = body.dry_run === true || !enabled;   // never moves money while disabled
    const nowMs = Date.now();
    const nowISO = new Date().toISOString();
    const reportable = referralBonus1099Reportable();

    const pending = await db.filter("ReferralBonus", { status: "pending" }, "-created_at", 2000).catch(() => []) as Record<string, unknown>[];

    const paid: Record<string, unknown>[] = [];
    const waiting: Record<string, unknown>[] = [];
    let totalSiteCash = 0;

    for (const b of pending) {
      const kind = String(b.kind);
      const amount = Math.max(0, Number(b.amount_sitecash) || 0);
      const elig = kind === "advertiser"
        ? advertiserBonusEligible({ payment_cleared_at: b.payment_cleared_at as string | null, refunded: b.refunded === true, chargeback: b.chargeback === true, kyc_ok: b.kyc_ok !== false, self_referral: b.self_referral === true, already_paid: false, nowMs, clawbackDays: referralAdvertiserClawbackDays() })
        : userBonusEligible({ active: b.active !== false, self_referral: b.self_referral === true, already_paid: false });

      if (!elig.eligible) { waiting.push({ bonus_id: b.id, kind, amount, reason: elig.reason }); continue; }

      if (dryRun) { waiting.push({ bonus_id: b.id, kind, amount, reason: enabled ? "would pay now" : "eligible — disabled (pending counsel)" }); continue; }

      // Credit Site Cash (the store-credit / points field), audit + 1099 ledger, mark paid — idempotent.
      const credited = await adjustUserBalance(String(b.referrer_user_id), amount, { field: "points" });
      if (credited === null) { waiting.push({ bonus_id: b.id, kind, amount, reason: "credit failed" }); continue; }
      await postLedgerEntry({
        user_id: String(b.referrer_user_id), amount, currency: "POINTS",
        type: reportable ? "referral_payout" : "referral_bonus_sitecash",
        idempotency_key: `refbonus:${b.id}`,
        meta: { kind, tier: b.tier ?? null, referred_user_id: b.referred_user_id, site_cash: true, reportable_1099: reportable },
      }).catch(() => null);
      await db.update("ReferralBonus", String(b.id), { status: "paid", paid_amount_sitecash: amount, paid_at: nowISO, reportable_1099: reportable, updated_at: nowISO }).catch(() => null);
      totalSiteCash += amount;
      paid.push({ bonus_id: b.id, kind, amount });
    }

    return Response.json({
      ok: true, enabled, dry_run: dryRun,
      paid_count: paid.length, total_sitecash: Math.round(totalSiteCash * 100) / 100, paid,
      waiting_count: waiting.length, waiting: waiting.slice(0, 100),
      note: enabled ? "Two-tier referral bonuses are ENABLED." : "Two-tier referral bonuses are OFF (pending counsel) — this is a preview only; no Site Cash moved.",
    });
  } catch (e) {
    return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 });
  }
});
