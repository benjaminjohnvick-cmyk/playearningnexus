// full-value-guarantee.ts — the "Full-Value Delivery Guarantee" that backs EVERY advertiser tier (Tier 1,
// Tier 2, Tier 3 Unlimited). It is a GUARANTEE, not a downsell:
//
//   You pay the full price UPFRONT. We deliver the full dollar amount of ADVERTISING you were promised —
//   and if we haven't by term end, we KEEP DELIVERING (free, capacity-paced, no time cap) until you've
//   received every dollar of it. If we ever genuinely can't finish delivering, we REFUND the difference for
//   whatever advertising was never delivered.
//
// COMPLIANCE SPINE (unchanged): the "dollar amount" is ADVERTISING VALUE delivered — impressions/placements at
// conventional rates — which we measure and control on-platform. It is NEVER the advertiser's revenue, sales,
// or ROI. So this is "we deliver what you paid for or your money back," never a results/return guarantee.
//
// Prepay upfront = prepayment, NOT credit. The refund is a backstop for UNDELIVERED advertising (bounded to the
// undelivered portion), never a performance/results payout. See FULL-VALUE-DELIVERY-GUARANTEE.md.
import { snapBool, snapNumber } from "./settings.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const fullValueGuaranteeEnabled = () => snapBool("FULL_VALUE_GUARANTEE_ENABLED", true);
/** Refund the undelivered difference if delivery can never be completed (advertiser exits / truly undeliverable). */
export const fullValueGuaranteeRefundBackstop = () => snapBool("FULL_VALUE_GUARANTEE_REFUND_BACKSTOP", true);
/** CPM used to translate impressions into the "dollar amount of advertising" delivered/promised. */
export const fvgCpmUsd = () => Math.max(0, snapNumber("FULL_VALUE_GUARANTEE_CPM_USD", 22));

/** Dollar value of an impression count at the conventional CPM. */
export function impressionsValueUsd(impressions: number, cpm = fvgCpmUsd()): number {
  return round2((Math.max(0, Number(impressions) || 0) / 1000) * Math.max(0, cpm));
}

export interface FvgStatus {
  promised_value_usd: number;    // the dollar amount of advertising the tier promised (guaranteed impressions × CPM)
  delivered_value_usd: number;   // dollar value delivered so far
  remaining_value_usd: number;   // still owed in advertising
  delivered_pct: number;         // 0..1
  fulfilled: boolean;            // received the full promised amount
  keep_delivering: boolean;      // we'll keep serving (free, no time cap) until fulfilled
  refund_if_closed_usd: number;  // pro-rata refund owed for undelivered advertising IF the guarantee were closed now
  note: string;
}

/** The full-value guarantee picture for one seat, in dollars. `priceUsd` is what the advertiser paid for the
 *  package (the refund is bounded to it). Pure + testable. */
export function fvgStatus(opts: {
  guaranteedImpressions: number; deliveredImpressions: number; priceUsd: number; cpm?: number;
}): FvgStatus {
  const cpm = opts.cpm ?? fvgCpmUsd();
  const guaranteed = Math.max(0, Math.round(opts.guaranteedImpressions));
  const delivered = Math.max(0, Math.min(guaranteed, Math.round(opts.deliveredImpressions)));
  const undelivered = Math.max(0, guaranteed - delivered);
  const price = Math.max(0, round2(opts.priceUsd));

  const promisedValue = impressionsValueUsd(guaranteed, cpm);
  const deliveredValue = impressionsValueUsd(delivered, cpm);
  const remainingValue = round2(Math.max(0, promisedValue - deliveredValue));
  const fulfilled = guaranteed > 0 ? delivered >= guaranteed : true;
  // Refund is bounded: the conventional value of undelivered advertising, never more than what was paid.
  const refundIfClosed = Math.min(price, impressionsValueUsd(undelivered, cpm));

  return {
    promised_value_usd: promisedValue,
    delivered_value_usd: deliveredValue,
    remaining_value_usd: remainingValue,
    delivered_pct: guaranteed > 0 ? round2(delivered / guaranteed) : 1,
    fulfilled,
    keep_delivering: !fulfilled && fullValueGuaranteeEnabled(),
    refund_if_closed_usd: round2(refundIfClosed),
    note: fulfilled
      ? "You've received the full amount of advertising you were promised."
      : `We've delivered $${deliveredValue.toLocaleString()} of your promised $${promisedValue.toLocaleString()} in advertising. ` +
        `We keep delivering (free, over time, no time cap) until you've received every dollar of it` +
        (fullValueGuaranteeRefundBackstop() ? `, and if we ever can't finish, we refund the $${round2(refundIfClosed).toLocaleString()} difference for what wasn't delivered.` : "."),
  };
}

/** The pro-rata refund owed for undelivered advertising (bounded to the price). Money movement stays gated. */
export function fvgRefundOwed(guaranteedImpressions: number, deliveredImpressions: number, priceUsd: number, cpm = fvgCpmUsd()): number {
  const guaranteed = Math.max(0, Math.round(guaranteedImpressions));
  const delivered = Math.max(0, Math.min(guaranteed, Math.round(deliveredImpressions)));
  const undelivered = Math.max(0, guaranteed - delivered);
  return round2(Math.min(Math.max(0, round2(priceUsd)), impressionsValueUsd(undelivered, cpm)));
}
