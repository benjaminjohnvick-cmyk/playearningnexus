// tier3-unlimited.ts — "Tier 3 Unlimited": uncapped scaling above the $200,000 Tier 2 base. An advertiser names a budget
// at or above the Tier 2 price and the package scales PROPORTIONALLY from the A–D rate card — more impressions,
// research, creative, and service — keeping the same conservative ~2× value ratio ("$X buys ~$2X in advertising
// value"). Same compliance spine as Tier 1/Tier 2:
//   • It's advertising VALUE delivered at conventional rates, NEVER a return/revenue/ROI promise.
//   • "As big as you can afford" = PREPAID upfront (closed-loop; not credit, not a loan).
//   • "As big as you want" = CAPACITY-PACED: the full allotment is guaranteed as a TOTAL over the term and
//     delivered as the audience grows, so inventory is never oversold — and it's backed by the delivery
//     guarantee (under-delivery is made good with free inventory).
// See TIER3-UNLIMITED-SPEC.md. Tracks/quotes only; moves no money.
import { snapNumber, snapBool } from "./settings.ts";
import { rateCard } from "./ai-ad-manager.ts";
import { tier2TotalUsd, tier2ImpressionsPerYear, tier2VideoViewsPerYear } from "./tier2-scaling.ts";
import { upgradePriceUsd } from "./founding-rollover.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const tier3UnlimitedEnabled = () => snapBool("TIER3_UNLIMITED_ENABLED", true);
/** When a budget exceeds what the audience can serve now, deliver the FULL purchased volume over time (no time
 *  cap on the make-good) until their number is matched. Bounded by volume (never more than sold), not by time. */
export const tier3UnlimitedMatchOverTime = () => snapBool("TIER3_UNLIMITED_MATCH_OVER_TIME", true);
/** Floor for Tier 3 Unlimited — at/above the base Tier 2 price. Never below the live (possibly 13-period) Tier 2
 *  price, so Tier 3 always starts at or above what a Tier 2 seat costs; an admin can set a higher floor. */
export const tier3UnlimitedMinUsd = () => Math.max(tier2TotalUsd(), snapNumber("TIER3_UNLIMITED_MIN_USD", tier2TotalUsd()));
/** Optional ceiling (0 = uncapped). A safety cap admins can set; 0 means scale as big as they can afford. */
export const tier3UnlimitedMaxUsd = () => Math.max(0, snapNumber("TIER3_UNLIMITED_MAX_USD", 0));

export interface Tier3UnlimitedGroup { group: string; label: string; subtotal_usd: number; }
export interface Tier3UnlimitedQuote {
  enabled: boolean;
  eligible: boolean;              // budget within [min, max?]
  min_usd: number;
  max_usd: number;               // 0 = uncapped
  base_usd: number;              // the Tier 2 base price the scale is relative to
  budget_usd: number;            // what the advertiser is spending (clamped to >= min)
  scale_factor: number;          // budget / base
  value_usd: number;             // conventional advertising value delivered (~2× budget)
  multiple: number;              // value / budget
  guaranteed_impressions_per_year: number; // impressions guaranteed (base allotment × factor), backed by the guarantee
  groups: Tier3UnlimitedGroup[];      // A–D group subtotals, scaled
  delivery_mode: "capacity_paced";
  prepay: boolean;               // always true — paid upfront, no credit
  note: string;
}

/** Quote a Tier 3 Unlimited package for a given budget (>= the Tier 2 base). Deliverables + value + guaranteed
 *  impressions scale linearly from the A–D rate card; delivery is capacity-paced and prepaid. */
export function tier3UnlimitedQuote(budgetUsd: number): Tier3UnlimitedQuote {
  const min = tier3UnlimitedMinUsd();
  const max = tier3UnlimitedMaxUsd();
  // Scale off the RAW Tier 2 base so the rate-card value ratio stays ~2× at any budget. (The 13-period uplift
  // rides on the FLOOR via `min` = tier2TotalUsd and on the budget the advertiser names; it must not also shrink
  // the value ratio, which using the uplifted price as the scale base would do.)
  const base = Math.max(1, upgradePriceUsd());
  const requested = round2(Number(budgetUsd) || 0);
  const budget = Math.max(min, requested);
  const eligible = budget >= min && (max <= 0 || budget <= max);
  const factor = round2(budget / base);

  const card = rateCard(base);
  const value = round2(card.list_value_usd * factor);
  const guaranteedImpr = Math.round((tier2ImpressionsPerYear() + tier2VideoViewsPerYear()) * factor);
  const groups = card.groups.map((g) => ({ group: g.group, label: g.label, subtotal_usd: round2(g.subtotal_usd * factor) }));

  return {
    enabled: tier3UnlimitedEnabled(),
    eligible,
    min_usd: min,
    max_usd: max,
    base_usd: base,
    budget_usd: budget,
    scale_factor: factor,
    value_usd: value,
    multiple: budget > 0 ? round2(value / budget) : 0,
    guaranteed_impressions_per_year: guaranteedImpr,
    groups,
    delivery_mode: "capacity_paced",
    prepay: true,
    note: `At $${budget.toLocaleString()} (${factor}× the $${base.toLocaleString()} Tier 2 base) you receive ~$${value.toLocaleString()} in advertising value ` +
      `(${budget > 0 ? round2(value / budget) : 0}×) and ${guaranteedImpr.toLocaleString()} guaranteed impressions/yr. Paid upfront; ` +
      `delivered capacity-paced (guaranteed as a total over your term, served as the audience grows) and backed by the delivery ` +
      `guarantee. This is advertising value delivered, not a promise of revenue or ROI.`,
  };
}

export interface DeliveryOutlook {
  guaranteed_total: number;         // the full purchased volume we commit to deliver
  current_annual_capacity: number;  // what the audience can serve per year right now
  exceeds_current_inventory: boolean;
  est_min_years_to_match: number;   // optimistic floor (assumes full capacity); shrinks as the audience grows
  matched_over_time: boolean;
  note: string;
}

/** How a Tier 3 Unlimited package delivers against current inventory. If the guaranteed volume is larger than
 *  the audience can serve in a year, it's delivered CAPACITY-PACED over multiple years — matched to their number
 *  over time — never oversold and never time-capped. `annualCapacity` is the live platform capacity (0 = unknown).
 *  Pure so it's testable; the endpoint passes the live capacity from the inventory governor. */
export function tier3UnlimitedDeliveryOutlook(guaranteedTotal: number, annualCapacity: number): DeliveryOutlook {
  const total = Math.max(0, Math.round(guaranteedTotal));
  const cap = Math.max(0, Math.round(annualCapacity));
  const exceeds = cap > 0 && total > cap;
  const estYears = cap > 0 ? Math.max(1, Math.ceil(total / cap)) : 0;
  const matched = tier3UnlimitedMatchOverTime();
  return {
    guaranteed_total: total,
    current_annual_capacity: cap,
    exceeds_current_inventory: exceeds,
    est_min_years_to_match: estYears,
    matched_over_time: matched,
    note: !exceeds
      ? "Your guaranteed volume fits within what the current audience serves — delivered across your term."
      : matched
        ? `Your ${total.toLocaleString()} impressions are more than the current audience serves in a year ` +
          `(~${cap.toLocaleString()}/yr). We deliver the full amount CAPACITY-PACED over time — matched to your ` +
          `number as the audience grows, however long it takes (at least ~${estYears} year${estYears === 1 ? "" : "s"} ` +
          `at today's audience, shorter as it grows). You get every impression you paid for; nothing is oversold.`
        : `Your ${total.toLocaleString()} impressions exceed current annual capacity (~${cap.toLocaleString()}/yr); ` +
          `enable match-over-time to deliver the full amount across multiple years.`,
  };
}
