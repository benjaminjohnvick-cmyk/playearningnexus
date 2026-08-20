// advertiser-cancellation.ts — 30-day proportional cancellation (cooling-off) for every advertiser tier.
//
// WHAT IT IS: a time-boxed buyer right. Within ADVERTISER_CANCELLATION_WINDOW_DAYS (30) of purchase, an
// advertiser may cancel and receive a PROPORTIONAL refund — we KEEP two-thirds and REFUND one-third of what they
// paid (at the 13-period price, Tier 1 $13,000 → keep $8,666.67, refund $4,333.33; 12-month $12,000 → $8,000 /
// $4,000). The refund is computed from what was actually paid, so it tracks the live price. Keyed to the
// PURCHASE DATE, not to delivery progress.
//
// HOW IT RELATES TO THE FULL-VALUE DELIVERY GUARANTEE (they are independent, and both stay on):
//   • Full-Value Guarantee = a DELIVERY promise: we keep delivering the advertising you paid for until it's met
//     (make-good only; refund backstop ships OFF). It governs AFTER the cancellation window.
//   • This cancellation = a COOLING-OFF exit right during the first 30 days: a partial money-back, not tied to
//     how much we've delivered. It does not read or flip the guarantee's refund backstop.
//
// COMPLIANCE: the kept portion is non-refundable and must be clearly disclosed up front (the endpoint records
// consent showing the exact keep/refund split before acting). The refund is issued as CLOSED-LOOP refund credit
// (refund_credit_balance), consistent with REFUND-POLICY.md — never a cash/card refund (that path stays gated).
// Pure math here; the endpoint moves the (closed-loop) balance. Not legal advice — have counsel finalize wording.
import { snapNumber, snapBool } from "./settings.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const DAY_MS = 86400000;

export const advertiserCancellationEnabled = () => snapBool("ADVERTISER_CANCELLATION_ENABLED", true);
/** Days after purchase during which a proportional cancellation is allowed. */
export const advertiserCancellationWindowDays = () => Math.max(1, Math.round(snapNumber("ADVERTISER_CANCELLATION_WINDOW_DAYS", 30)));
/** Fraction of what was paid that is REFUNDED on an in-window cancellation (default 1/3 → keep two-thirds).
 *  Stored at full double precision so the third is computed cleanly (a $12,000 base refunds exactly $4,000; the
 *  13-period $13,000 refunds $4,333.33). */
export const advertiserCancellationRefundPct = () =>
  Math.min(1, Math.max(0, snapNumber("ADVERTISER_CANCELLATION_REFUND_PCT", 0.3333333333333333)));

export interface CancellationQuote {
  enabled: boolean;
  within_window: boolean;      // is the cancellation right currently available?
  window_days: number;
  days_since_purchase: number;
  days_left: number;           // days remaining to cancel (0 once the window closes)
  paid_usd: number;
  refund_pct: number;          // fraction refunded
  refund_usd: number;          // proportional refund owed (closed-loop credit)
  kept_usd: number;            // non-refundable portion we keep
  note: string;
}

/** Pure: quote a proportional cancellation for an advertiser seat/plan. `purchasedAtISO` anchors the window
 *  (FoundingAdvertiser.purchased_at for Tier 1; Tier2ScalingPlan.started_at for Tier 2 / Tier 3). `paidUsd` is
 *  what the advertiser actually paid (tier price / plan paid_usd / Tier 3 budget). */
export function cancellationQuote(opts: { paidUsd: number; purchasedAtISO: string; nowMs: number }): CancellationQuote {
  const paid = Math.max(0, round2(opts.paidUsd));
  const windowDays = advertiserCancellationWindowDays();
  const start = Date.parse(String(opts.purchasedAtISO || ""));
  const validStart = Number.isFinite(start);
  const daysSince = validStart ? Math.max(0, Math.floor((opts.nowMs - start) / DAY_MS)) : Number.POSITIVE_INFINITY;
  const withinWindow = validStart && daysSince <= windowDays;
  const daysLeft = withinWindow ? Math.max(0, windowDays - daysSince) : 0;

  const pct = advertiserCancellationRefundPct();
  const refund = withinWindow ? round2(paid * pct) : 0;
  const kept = withinWindow ? round2(paid - refund) : 0;

  return {
    enabled: advertiserCancellationEnabled(),
    within_window: withinWindow,
    window_days: windowDays,
    days_since_purchase: validStart ? daysSince : 0,
    days_left: daysLeft,
    paid_usd: paid,
    refund_pct: pct,
    refund_usd: refund,
    kept_usd: kept,
    note: withinWindow
      ? `Cancel within your ${windowDays}-day window (${daysLeft} day${daysLeft === 1 ? "" : "s"} left): we keep ` +
        `$${kept.toLocaleString()} and refund $${refund.toLocaleString()} as site refund credit. The kept portion ` +
        `is non-refundable and disclosed up front.`
      : `The ${windowDays}-day cancellation window has passed. Your advertising is covered by the Full-Value ` +
        `Delivery Guarantee — we keep delivering the advertising you paid for until it's met (make-good).`,
  };
}
