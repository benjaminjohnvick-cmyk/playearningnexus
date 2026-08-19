import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import { adjustUserBalance } from "../../sdk/balance.ts";
import { recordConsent } from "../../sdk/consent-ledger.ts";
import { foundingPriceUsd, FA_STATUS } from "../../sdk/founding-advertiser.ts";
import { tier2TotalUsd } from "../../sdk/tier2-scaling.ts";
import {
  cancellationQuote, advertiserCancellationEnabled, advertiserCancellationWindowDays,
} from "../../sdk/advertiser-cancellation.ts";

// advertiserCancel (auth) — the 30-day PROPORTIONAL cancellation (cooling-off) for any advertiser tier.
// Within the window we keep two-thirds and refund one-third of what was paid, issued as CLOSED-LOOP site refund
// credit (never cash/card — that path stays gated). Independent of the Full-Value Delivery Guarantee, which
// governs after the window (deliver-until-met, make-good). Send { confirm:true } to execute; otherwise previews.
//   Body: { confirm?: boolean }
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!advertiserCancellationEnabled()) {
      return Response.json({ enabled: false, reason: "advertiser cancellation disabled" }, { status: 403 });
    }
    const body = await req.json().catch(() => ({}));
    const confirm = body?.confirm === true;
    const uid = String(user.id);
    const nowMs = Date.now();

    // Resolve the caller's advertiser package: a Tier 2 / Tier 3 plan takes precedence, else the Tier 1 seat.
    const plans = await db.filter("Tier2ScalingPlan", { user_id: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
    let entity: "Tier2ScalingPlan" | "FoundingAdvertiser";
    let rec: Record<string, unknown> | null = null;
    let tier: "tier1" | "tier2" | "tier3"; let paidUsd: number; let purchasedAt: string;

    if (plans && plans[0]) {
      rec = plans[0]; entity = "Tier2ScalingPlan";
      const budget = Number(rec.budget_usd) || 0;
      tier = budget > 0 ? "tier3" : "tier2";
      paidUsd = budget > 0 ? budget : (Number(rec.paid_usd) > 0 ? Number(rec.paid_usd) : tier2TotalUsd());
      purchasedAt = String(rec.started_at ?? rec.current_year_started_at ?? rec.created_date ?? "");
    } else {
      const seats = await db.filter("FoundingAdvertiser", { user_id: uid, status: "active" }, "-created_date", 1).catch(() => []) as Record<string, unknown>[];
      if (!seats || !seats[0]) return Response.json({ error: "No active advertiser package found to cancel." }, { status: 404 });
      rec = seats[0]; entity = "FoundingAdvertiser";
      tier = "tier1";
      paidUsd = Number(rec.price_usd) > 0 ? Number(rec.price_usd) : foundingPriceUsd();
      purchasedAt = String(rec.purchased_at ?? rec.credit_start ?? rec.created_date ?? "");
    }

    const quote = cancellationQuote({ paidUsd, purchasedAtISO: purchasedAt, nowMs });

    // Preview: show the exact keep/refund split + window before anything happens.
    if (!confirm) {
      return Response.json({
        preview: true, tier, entity, seat_id: String(rec!.id), quote,
        window_days: advertiserCancellationWindowDays(),
        disclosure: `If you cancel now we KEEP $${quote.kept_usd.toLocaleString()} (non-refundable) and REFUND ` +
          `$${quote.refund_usd.toLocaleString()} as site refund credit. This cancellation is separate from the ` +
          `Full-Value Delivery Guarantee, which otherwise keeps delivering your advertising until it's met.`,
        note: "Send { confirm: true } to cancel and issue the refund credit.",
      });
    }

    // Execute — only inside the window.
    if (!quote.within_window) {
      return Response.json({
        cancelled: false, reason: "outside_window", quote,
        message: `The ${quote.window_days}-day cancellation window has passed. Your advertising stays covered by ` +
          `the Full-Value Delivery Guarantee — we keep delivering what you paid for until it's met.`,
      }, { status: 409 });
    }

    const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || null;
    await recordConsent({
      user_id: uid, kind: "advertiser_cancellation", version: "2026-01", accepted: true,
      shown: quote, ip, meta: { tier, entity, seat_id: String(rec!.id), kept_usd: quote.kept_usd, refund_usd: quote.refund_usd },
    }).catch(() => null);

    // Mark the package cancelled (frees its inventory reservation — the governor drops non-active/cancelled rows).
    await db.update(entity, String(rec!.id), {
      status: entity === "FoundingAdvertiser" ? FA_STATUS.CANCELLED : "cancelled",
      cancelled_at: new Date().toISOString(),
      cancellation_kept_usd: quote.kept_usd,
      cancellation_refund_usd: quote.refund_usd,
    }).catch(() => null);

    // Issue the proportional refund as CLOSED-LOOP site refund credit (never cash/card).
    let refundIssued = 0;
    if (quote.refund_usd > 0) {
      const bal = await adjustUserBalance(uid, quote.refund_usd, { field: "refund_credit_balance" }).catch(() => null);
      if (bal !== null) refundIssued = quote.refund_usd;
    }

    return Response.json({
      ok: true, cancelled: true, tier, entity, seat_id: String(rec!.id),
      kept_usd: quote.kept_usd, refund_credit_usd: refundIssued, refund_owed_usd: quote.refund_usd,
      refund_method: "site_refund_credit",
      note: refundIssued === quote.refund_usd
        ? `Cancelled. We kept $${quote.kept_usd.toLocaleString()} and credited $${refundIssued.toLocaleString()} to your site refund balance.`
        : `Cancelled and recorded a $${quote.refund_usd.toLocaleString()} refund owed; crediting is being retried.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
