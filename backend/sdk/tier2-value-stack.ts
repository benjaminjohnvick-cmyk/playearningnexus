// tier2-value-stack.ts — the "$200,000 → $400,000 in advertising value" stack for Tier 2 "Scale".
//
// Same compliant shape as the Tier 1 value stack: the advertiser pays $200,000 and receives at least $400,000
// of ADVERTISING VALUE — the A–D rate card (media, creative, research, managed service) valued at conventional
// market rates. It is NOT a promise of a $400,000 return, revenue, or ROI (that would be an unsubstantiated
// performance guarantee). The number lives entirely on the value-DELIVERED side:
//   • The itemized rate card (ai-ad-manager.ts CATALOG) already sums to ~$404k at conventional rates.
//   • The impression lines are BACKED BY THE DELIVERY GUARANTEE — under-delivery is made good with free
//     inventory (bounded). So the advertising is guaranteed to be delivered, not just quoted.
//   • If the rate card is ever trimmed below the 2× target, a "value-match" block of GUARANTEED bonus
//     impressions closes the gap (real advertising at the CPM), never an inflated rate.
import { snapNumber, snapBool } from "./settings.ts";
import { rateCard, type RateCard } from "./ai-ad-manager.ts";
import { tier2TotalUsd, tier2ImpressionsPerYear, tier2VideoViewsPerYear } from "./tier2-scaling.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const tier2ValueStackEnabled = () => snapBool("TIER2_VALUE_STACK_ENABLED", true);
/** Target value multiple over the Tier 2 price (2 = "$200k → $400k"). */
export const tier2ValueMultipleTarget = () => Math.max(1, snapNumber("TIER2_VALUE_MULTIPLE_TARGET", 2));
/** Explicit target value; 0 = derive from price × multiple. */
export const tier2ValueTargetUsd = () => Math.max(0, snapNumber("TIER2_VALUE_TARGET_USD", 0));
/** CPM used to VALUE and SIZE any value-match bonus impressions (matches the rate card's interstitial basis). */
export const tier2ValueCpmUsd = () => Math.max(0, snapNumber("TIER2_VALUE_CPM_USD", 22));

export interface Tier2ValueStack {
  price_usd: number;
  target_value_usd: number;
  multiple_target: number;
  rate_card: RateCard;            // itemized A–D lines + per-group subtotals + list value
  included_value_usd: number;     // sum of the real rate-card lines
  value_match_bonus_impressions: number; // extra GUARANTEED impressions added to reach target (0 if none)
  value_match_value_usd: number;
  total_value_usd: number;        // included + value-match (>= target when the stack is on)
  multiple_actual: number;        // total_value / price
  meets_target: boolean;
  guaranteed_impressions_per_year: number; // impressions the delivery guarantee backs (base + value-match)
  note: string;
}

/** Build the Tier 2 value stack from the live A–D rate card. If the honestly-valued lines fall below the 2×
 *  target, size a block of GUARANTEED value-match impressions (at the CPM) to close the gap — real advertising,
 *  not an inflated rate — and fold it into the impression total the delivery guarantee backs. */
export function tier2ValueStack(): Tier2ValueStack {
  const price = tier2TotalUsd();
  const multiple = tier2ValueMultipleTarget();
  const target = tier2ValueTargetUsd() > 0 ? tier2ValueTargetUsd() : round2(price * multiple);
  const card = rateCard(price);
  const included = round2(card.list_value_usd);

  const cpm = tier2ValueCpmUsd();
  let bonusImpr = 0, bonusValue = 0;
  if (included < target && cpm > 0) {
    bonusValue = round2(target - included);
    bonusImpr = Math.ceil((bonusValue / cpm) * 1000);
  }
  const total = round2(included + bonusValue);
  const baseImprPerYear = tier2ImpressionsPerYear() + tier2VideoViewsPerYear();

  return {
    price_usd: price,
    target_value_usd: target,
    multiple_target: multiple,
    rate_card: card,
    included_value_usd: included,
    value_match_bonus_impressions: bonusImpr,
    value_match_value_usd: bonusValue,
    total_value_usd: total,
    multiple_actual: price > 0 ? round2(total / price) : 0,
    meets_target: total >= target,
    guaranteed_impressions_per_year: baseImprPerYear + bonusImpr,
    note: bonusImpr > 0
      ? `The A–D rate card totals $${included.toLocaleString()} at conventional rates; we add ${bonusImpr.toLocaleString()} guaranteed bonus impressions to bring delivered advertising value to $${total.toLocaleString()} (${price > 0 ? round2(total / price) : 0}× your price). Impression delivery is guaranteed — under-delivery is made good with free inventory.`
      : `Your $${price.toLocaleString()} Tier 2 package delivers $${total.toLocaleString()} in advertising value at conventional rates (${price > 0 ? round2(total / price) : 0}×). Impression delivery is guaranteed — under-delivery is made good with free inventory. This is advertising value delivered, not a promise about your revenue or ROI.`,
  };
}

/** Extra guaranteed impressions/yr the value-match adds (0 if the rate card already meets target or the stack
 *  is off). The delivery guarantee adds this to the Tier 2 guaranteed volume so the $400k is really backed. */
export function tier2ValueMatchBonusImpressions(): number {
  if (!tier2ValueStackEnabled()) return 0;
  return tier2ValueStack().value_match_bonus_impressions;
}
