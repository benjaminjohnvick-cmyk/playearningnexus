// tier1-value-stack.ts — the "$12,000 → $24,000 in advertising value" stack for the Tier 1 / founding offer.
//
// This is the COMPLIANT way to headline a 2x: the advertiser pays $12,000 and receives at least $24,000 of
// ADVERTISING VALUE — real, delivered advertising (impressions, placements, creative, managed service) valued
// at conventional market rates. It is NOT a promise about the advertiser's revenue, sales, or ROI (that would
// be an unsubstantiated performance guarantee). The number lives entirely on the value-DELIVERED side:
//   • Every line is a real deliverable, valued at a conventional, defensible rate (mirrors the Tier 2 rate card).
//   • The impression lines are BACKED BY THE DELIVERY GUARANTEE — if we under-deliver them, the make-good tops
//     them up free (bounded). So the $24k of advertising is guaranteed to be delivered, not just quoted.
//   • If the honest sum of what's included falls below the 2x target, we size a "value-match" block of
//     GUARANTEED bonus impressions to close the gap — i.e. we deliver MORE real advertising, never inflate a rate.
//
// Values are conventional and admin-tunable (TIER1_VALUE_CARD_JSON). Tracks state only; moves no money.
import { snapNumber, snapString, snapBool } from "./settings.ts";
import {
  foundingPriceUsd, foundingImpressionsPerYear, tier1LaunchBonusImpressions,
  tier1AiCreativeIncluded, tier1AiCampaignManager, tier1AiSocialPostsPerMonth, tier1AbTestingIncluded,
  tier1AnalyticsIncluded, tier1SentimentInsightsIncluded, tier1FeaturedPlacement,
  tier1PrioritySupport, tier1IncludesPremium, foundingSocialAdsEnabled,
} from "./founding-advertiser.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export const tier1ValueStackEnabled = () => snapBool("TIER1_VALUE_STACK_ENABLED", true);
/** Target value multiple over the price (2 = "$12k → $24k"). */
export const tier1ValueMultipleTarget = () => Math.max(1, snapNumber("TIER1_VALUE_MULTIPLE_TARGET", 2));
/** Explicit target value; 0 = derive from price × multiple. */
export const tier1ValueTargetUsd = () => Math.max(0, snapNumber("TIER1_VALUE_TARGET_USD", 0));
/** CPM used to VALUE impressions and to SIZE any value-match bonus (conventional interstitial rate). */
export const tier1ValueCpmUsd = () => Math.max(0, snapNumber("TIER1_VALUE_CPM_USD", 22));

export interface Tier1ValueLine {
  key: string;
  name: string;
  value_usd: number;          // conventional annual value of this line
  delivery_guaranteed: boolean; // impression lines are backed by the delivery guarantee / make-good
  one_time?: boolean;
  basis: string;
}

/** The included-deliverables catalog for Tier 1, valued at conventional rates. Each feature line respects its
 *  existing on/off toggle, so the stack reflects what's actually delivered. Impression values use the CPM. */
function tier1Catalog(): Tier1ValueLine[] {
  const cpm = tier1ValueCpmUsd();
  const imprPerYear = foundingImpressionsPerYear();
  const bonusImpr = tier1LaunchBonusImpressions();
  const socialPerYear = tier1AiSocialPostsPerMonth() * 12;

  const lines: Tier1ValueLine[] = [];
  const add = (on: boolean, l: Tier1ValueLine) => { if (on && l.value_usd > 0) lines.push(l); };

  add(imprPerYear > 0, {
    key: "between_survey_impressions",
    name: `Between-survey ad impressions (${imprPerYear.toLocaleString()}/yr)`,
    value_usd: round2((imprPerYear / 1000) * cpm), delivery_guaranteed: true,
    basis: `~$${cpm} CPM, first-party high-attention in-app inventory`,
  });
  add(bonusImpr > 0, {
    key: "launch_bonus_impressions",
    name: `Launch-bonus impressions (${bonusImpr.toLocaleString()}, one-time)`,
    value_usd: round2((bonusImpr / 1000) * cpm), delivery_guaranteed: true, one_time: true,
    basis: `~$${cpm} CPM one-time bonus allotment`,
  });
  add(foundingSocialAdsEnabled() && socialPerYear > 0, {
    key: "social_ad_posts",
    name: `Managed social ad posts (${socialPerYear.toLocaleString()}/yr)`,
    value_usd: round2(socialPerYear * snapNumber("TIER1_VALUE_PER_SOCIAL_POST_USD", 12.5)),
    delivery_guaranteed: false, basis: "managed social content, per-post conventional rate",
  });
  add(tier1AiCreativeIncluded(), {
    key: "managed_ad_creative", name: "AI ad-creative production (ongoing refresh)",
    value_usd: snapNumber("TIER1_VALUE_CREATIVE_USD", 3000), delivery_guaranteed: false,
    basis: "AI creative generation (agency-retainer equivalent, AI-priced)",
  });
  add(tier1AiCampaignManager(), {
    key: "ai_campaign_manager", name: "Always-on AI campaign manager + optimization",
    value_usd: snapNumber("TIER1_VALUE_CAMPAIGN_MGR_USD", 3000), delivery_guaranteed: false,
    basis: "AI campaign management + optimization (human escalation available); not sold as a dedicated human",
  });
  add(tier1AbTestingIncluded(), {
    key: "ab_testing", name: "Automatic A/B testing program",
    value_usd: snapNumber("TIER1_VALUE_ABTEST_USD", 2000), delivery_guaranteed: false,
    basis: "testing tooling + AI analysis",
  });
  add(tier1AnalyticsIncluded(), {
    key: "analytics_dashboard", name: "Real-time analytics & attribution dashboard",
    value_usd: snapNumber("TIER1_VALUE_ANALYTICS_USD", 2400), delivery_guaranteed: false,
    basis: "~$200/mo SaaS-equivalent",
  });
  add(tier1SentimentInsightsIncluded(), {
    key: "sentiment_insights", name: "Consumer-sentiment insights",
    value_usd: snapNumber("TIER1_VALUE_SENTIMENT_USD", 1800), delivery_guaranteed: false,
    basis: "aggregate, anonymized sentiment analysis",
  });
  add(tier1FeaturedPlacement(), {
    key: "featured_placement", name: "Featured placement + sponsor-wall spot",
    value_usd: snapNumber("TIER1_VALUE_FEATURED_USD", 3000), delivery_guaranteed: false,
    basis: "fixed premium placement",
  });
  add(tier1PrioritySupport(), {
    key: "priority_support", name: "Priority concierge support",
    value_usd: snapNumber("TIER1_VALUE_SUPPORT_USD", 1200), delivery_guaranteed: false,
    basis: "front-of-line support",
  });
  add(tier1IncludesPremium(), {
    key: "premium_membership", name: "Premium membership included",
    value_usd: snapNumber("TIER1_VALUE_PREMIUM_USD", 1000), delivery_guaranteed: false,
    basis: "Premium membership at no extra cost",
  });
  return lines;
}

export interface Tier1ValueStack {
  price_usd: number;
  target_value_usd: number;
  multiple_target: number;
  lines: Tier1ValueLine[];
  included_value_usd: number;       // sum of the real included lines
  value_match_bonus_impressions: number; // extra GUARANTEED impressions added to reach the target (0 if none)
  value_match_value_usd: number;    // value of that bonus block
  total_value_usd: number;          // included + value-match (>= target when the stack is on)
  multiple_actual: number;          // total_value / price
  meets_target: boolean;
  guaranteed_impressions_per_year: number; // impressions the delivery guarantee backs (base + value-match)
  note: string;
}

/** Build the Tier 1 value stack. If the honestly-valued included lines fall below the 2x target, size a block
 *  of GUARANTEED bonus impressions (valued at the CPM) to close the gap — real advertising, not an inflated
 *  rate. The impression total returned is what the delivery guarantee should guarantee to back the $24k claim. */
export function tier1ValueStack(): Tier1ValueStack {
  const price = foundingPriceUsd();
  const multiple = tier1ValueMultipleTarget();
  const target = tier1ValueTargetUsd() > 0 ? tier1ValueTargetUsd() : round2(price * multiple);
  const lines = tier1Catalog();
  const included = round2(lines.reduce((s, l) => s + l.value_usd, 0));

  const cpm = tier1ValueCpmUsd();
  let bonusImpr = 0, bonusValue = 0;
  if (included < target && cpm > 0) {
    bonusValue = round2(target - included);
    bonusImpr = Math.ceil((bonusValue / cpm) * 1000);
  }
  const total = round2(included + bonusValue);
  const baseImprPerYear = foundingImpressionsPerYear();

  return {
    price_usd: price,
    target_value_usd: target,
    multiple_target: multiple,
    lines,
    included_value_usd: included,
    value_match_bonus_impressions: bonusImpr,
    value_match_value_usd: bonusValue,
    total_value_usd: total,
    multiple_actual: price > 0 ? round2(total / price) : 0,
    meets_target: total >= target,
    guaranteed_impressions_per_year: baseImprPerYear + bonusImpr,
    note: bonusImpr > 0
      ? `Your package includes $${included.toLocaleString()} of advertising at conventional rates; we add ${bonusImpr.toLocaleString()} guaranteed bonus impressions to bring your delivered advertising value to $${total.toLocaleString()} (${price > 0 ? round2(total / price) : 0}× your price). Impression delivery is guaranteed — if we fall short, we make it up with free inventory.`
      : `Your $${price.toLocaleString()} package delivers $${total.toLocaleString()} in advertising value at conventional rates (${price > 0 ? round2(total / price) : 0}×). Impression delivery is guaranteed — if we fall short, we make it up with free inventory. This is advertising value delivered, not a promise about your revenue or ROI.`,
  };
}

/** Extra guaranteed impressions/yr the value-match adds (0 if the included lines already meet the target or the
 *  stack is off). The delivery guarantee adds this to the Tier 1 guaranteed volume so the $24k is really backed. */
export function tier1ValueMatchBonusImpressions(): number {
  if (!tier1ValueStackEnabled()) return 0;
  return tier1ValueStack().value_match_bonus_impressions;
}
