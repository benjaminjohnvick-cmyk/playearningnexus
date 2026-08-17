// tier2-deposit.ts — take a full-year (or full-term) deposit UPFRONT for a capacity-paced Tier 2 seat.
//
// This is a PREPAYMENT for advertising delivered over time — the advertiser pays the platform now, so it is
// NOT credit, NOT a loan, NOT money transmission (the opposite of the retired "pay-at-year-end" idea). Because
// Tier 2 can be capacity-paced (impressions delivered as the audience grows), a year's deposit is money held
// for impressions NOT YET DELIVERED — i.e. UNEARNED REVENUE. Two rules keep that fair:
//   1. Earned as delivered — the deposit is recognized only as impressions are actually served.
//   2. Make-good OR refund the shortfall — any allotment still undelivered at term end is either delivered
//      (delivery extended until the full paid allotment is served) or refunded pro-rata. The advertiser always
//      gets every impression they paid for, or their money back for what wasn't delivered.
// See TIER2-DEPOSITS.md. Not legal advice.
import { snapBool, snapNumber, snapString } from "./settings.ts";
import { tier2TotalUsd, tier2Parts, tier2ImpressionsPerYear, tier2VideoViewsPerYear } from "./tier2-scaling.ts";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const tier2DepositEnabled = () => snapBool("TIER2_DEPOSIT_ENABLED", true);
/** How many parts/months are prepaid in a deposit (12 = a full year; can be set to the full term). */
export const tier2DepositMonths = () => Math.max(1, Math.round(snapNumber("TIER2_DEPOSIT_MONTHS", 12)));
/** What happens to undelivered impressions at term end: "extend" delivery until served, or "refund" pro-rata. */
export const tier2DepositMakeGoodMode = () => (snapString("TIER2_DEPOSIT_MAKEGOOD_MODE", "extend") === "refund" ? "refund" : "extend");
export const tier2DepositRefundUndelivered = () => snapBool("TIER2_DEPOSIT_REFUND_UNDELIVERED", true);

/** The impression allotment a full-year deposit pays for (impressions + video), scaled to the deposit length. */
export function depositPaidImpressions(months = tier2DepositMonths()): number {
  const yearAllot = tier2ImpressionsPerYear() + tier2VideoViewsPerYear();
  return Math.round(yearAllot * (months / tier2Parts()));
}

export interface DepositQuote { months: number; gross_usd: number; discount_pct: number; discount_usd: number; net_usd: number; paid_impressions: number; }

/** The upfront deposit amount for `months` of Tier 2, with the founding/rollover discount applied. */
export function depositQuote(discountPct = 0, months = tier2DepositMonths()): DepositQuote {
  const gross = r2((months / tier2Parts()) * tier2TotalUsd());
  const disc = Math.min(1, Math.max(0, Number(discountPct) || 0));
  const discountUsd = r2(gross * disc);
  return { months, gross_usd: gross, discount_pct: disc, discount_usd: discountUsd, net_usd: r2(gross - discountUsd), paid_impressions: depositPaidImpressions(months) };
}

export interface DepositDeliveryStatus {
  deposit_usd: number;            // what they prepaid (net)
  paid_impressions: number;       // impressions the deposit paid for
  delivered_impressions: number;  // actually served so far
  undelivered_impressions: number;
  delivered_pct: number;          // 0..1
  earned_usd: number;             // deposit recognized as revenue so far (= deposit × delivered_pct)
  unearned_usd: number;           // still held against undelivered impressions (a liability)
  make_good_mode: "extend" | "refund";
  refundable_now_usd: number;     // pro-rata refund owed IF the term ended now and mode is refund (else 0)
  amount_owed_to_platform_usd: number; // ALWAYS 0 — it's a prepayment, nothing is owed to the platform
  note: string;
}

/** Delivered-vs-paid picture for a deposit. `termEnded` = whether the delivery term is over (drives whether a
 *  refund is currently owed under refund mode). */
export function depositDeliveryStatus(opts: {
  depositUsd: number; paidImpressions: number; deliveredImpressions: number; termEnded?: boolean;
}): DepositDeliveryStatus {
  const deposit = r2(opts.depositUsd);
  const paid = Math.max(0, Math.round(opts.paidImpressions));
  const delivered = Math.max(0, Math.min(paid, Math.round(opts.deliveredImpressions)));
  const undelivered = Math.max(0, paid - delivered);
  const pct = paid > 0 ? delivered / paid : 1;
  const earned = r2(deposit * pct);
  const unearned = r2(deposit - earned);
  const mode = tier2DepositMakeGoodMode();
  // A refund is owed only at term end, only in refund mode, only for the undelivered portion.
  const refundable = (opts.termEnded && mode === "refund" && tier2DepositRefundUndelivered()) ? unearned : 0;
  const note = mode === "extend"
    ? "Your deposit is earned only as impressions deliver; any undelivered impressions are delivered after term end (make-good) until your full paid allotment is served."
    : "Your deposit is earned only as impressions deliver; any impressions undelivered at term end are refunded to you pro-rata.";
  return {
    deposit_usd: deposit, paid_impressions: paid, delivered_impressions: delivered,
    undelivered_impressions: undelivered, delivered_pct: r2(pct),
    earned_usd: earned, unearned_usd: unearned, make_good_mode: mode,
    refundable_now_usd: r2(refundable), amount_owed_to_platform_usd: 0, note,
  };
}

export function depositDisclosures(q: DepositQuote): string[] {
  const mode = tier2DepositMakeGoodMode();
  return [
    `You're prepaying $${q.net_usd.toLocaleString()} for ${q.paid_impressions.toLocaleString()} impressions over your Tier 2 term.`,
    "This is a prepayment for advertising services — not a loan, deposit account, or investment. Nothing is owed by you beyond it.",
    "Delivery is paced to our audience and accelerates as it grows. Your deposit is earned by us only as impressions are actually delivered.",
    mode === "extend"
      ? "If any impressions you paid for aren't delivered by term end, delivery is extended (made good) until your full paid allotment is served."
      : "If any impressions you paid for aren't delivered by term end, that undelivered portion is refunded to you pro-rata.",
    "The undelivered portion is held as unearned revenue (your money against future delivery) until it's delivered or resolved.",
  ];
}
