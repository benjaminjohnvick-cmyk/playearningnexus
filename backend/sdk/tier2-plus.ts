// tier2-plus.ts — "Tier 2 Plus": uncapped scaling above the $200,000 Tier 2 base. An advertiser names a budget
// at or above the Tier 2 price and the package scales PROPORTIONALLY from the A–D rate card — more impressions,
// research, creative, and service — keeping the same conservative ~2× value ratio ("$X buys ~$2X in advertising
// value"). Same compliance spine as Tier 1/Tier 2:
//   • It's advertising VALUE delivered at conventional rates, NEVER a return/revenue/ROI promise.
//   • "As big as you can afford" = PREPAID upfront (closed-loop; not credit, not a loan).
//   • "As big as you want" = CAPACITY-PACED: the full allotment is guaranteed as a TOTAL over the term and
//     delivered as the audience grows, so inventory is never oversold — and it's backed by the delivery
//     guarantee (under-delivery is made good with free inventory).
// See TIER2-PLUS-SPEC.md. Tracks/quotes only; moves no money.
import { snapNumber, snapBool } from "./settings.ts";
import { rateCard } from "./ai-ad-manager.ts";
import { tier2TotalUsd, tier2ImpressionsPerYear, tier2VideoViewsPerYear } from "./tier2-scaling.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const tier2PlusEnabled = () => snapBool("TIER2_PLUS_ENABLED", true);
/** Floor for Tier 2 Plus — at/above the base Tier 2 price. Default = the live Tier 2 price ($200,000). */
export const tier2PlusMinUsd = () => Math.max(0, snapNumber("TIER2_PLUS_MIN_USD", tier2TotalUsd()));
/** Optional ceiling (0 = uncapped). A safety cap admins can set; 0 means scale as big as they can afford. */
export const tier2PlusMaxUsd = () => Math.max(0, snapNumber("TIER2_PLUS_MAX_USD", 0));

export interface Tier2PlusGroup { group: string; label: string; subtotal_usd: number; }
export interface Tier2PlusQuote {
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
  groups: Tier2PlusGroup[];      // A–D group subtotals, scaled
  delivery_mode: "capacity_paced";
  prepay: boolean;               // always true — paid upfront, no credit
  note: string;
}

/** Quote a Tier 2 Plus package for a given budget (>= the Tier 2 base). Deliverables + value + guaranteed
 *  impressions scale linearly from the A–D rate card; delivery is capacity-paced and prepaid. */
export function tier2PlusQuote(budgetUsd: number): Tier2PlusQuote {
  const min = tier2PlusMinUsd();
  const max = tier2PlusMaxUsd();
  const base = Math.max(1, tier2TotalUsd());
  const requested = round2(Number(budgetUsd) || 0);
  const budget = Math.max(min, requested);
  const eligible = budget >= min && (max <= 0 || budget <= max);
  const factor = round2(budget / base);

  const card = rateCard(base);
  const value = round2(card.list_value_usd * factor);
  const guaranteedImpr = Math.round((tier2ImpressionsPerYear() + tier2VideoViewsPerYear()) * factor);
  const groups = card.groups.map((g) => ({ group: g.group, label: g.label, subtotal_usd: round2(g.subtotal_usd * factor) }));

  return {
    enabled: tier2PlusEnabled(),
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
