// advertiser-features.ts — the TIERED ADVERTISER FEATURE CATALOG.
//
// Purpose: take the advertiser-facing revenue streams (the subset of the 8-category REVENUE_LEVERS map that an
// advertiser actually buys) and turn them into ADD-ON FEATURES layered onto Tiers 1–3, priced in by the
// value-stack model. Decision (locked with the owner):
//   • Scope: ADVERTISER-FACING features only (clean fit for the advertiser tiers). User-facing streams
//     (cosmetics, boosts) and structural fees stay where they are — they are tracked by the PMF scoreboard
//     (feature-pmf.ts) but are not tier features.
//   • Pricing: HOLD tier prices; as live features stack, the delivered-value RATIO climbs (more value for the
//     same money). This module reports the climbing ratio; it never changes a price or makes an ROI claim.
//   • Founding / pre-revenue Tier 1 gets the WHOLE catalog free (all tiers), as its founding privilege — the
//     panel that helps find product-market fit. Standard tiers get their own tier's features and below.
//
// Compliance: a feature only contributes DELIVERED value while it is actually LIVE. A GATED feature (needs a
// third-party account) or COUNSEL feature (needs an attorney) is listed as "included — activates when its
// prerequisite lands" and contributes $0 of claimed value until then. This mirrors the value-stack rule that
// every line respects its own on/off toggle, so the headline stays substantiated. Not legal advice.
import { snapBool, snapNumber, snapString } from "./settings.ts";
import { foundingPriceUsd } from "./founding-advertiser.ts";

export const advertiserFeatureCatalogEnabled = () => snapBool("ADVERTISER_FEATURE_CATALOG_ENABLED", true);

export type FeatureTier = 1 | 2 | 3;
export type FeatureReadiness = "live" | "gated" | "counsel";

export interface AdvertiserFeatureDef {
  key: string;
  name: string;
  tier: FeatureTier;            // the LOWEST tier that includes this feature (higher tiers include it too)
  base_value_usd: number;      // conventional annual value of the feature when delivered
  revenue_type: string;        // the RevenueEvent `type` it books to (for the per-tier revenue ranking)
  status: FeatureReadiness;    // baseline readiness; a "gated"/"counsel" flips to live when its flag is on
  gate_flag?: string;          // sensitive *_ENABLED flag that unlocks a gated/counsel feature
  category: number;            // which of the 8 revenue-stream categories it comes from
  basis: string;
}

// The curated advertiser-facing add-on catalog. Values are conventional and admin-overridable as a whole via
// ADVERTISER_FEATURE_CATALOG_JSON ({ "<key>": <value_usd>, ... }); anything not overridden uses base_value_usd.
// These are ADD-ONS beyond each tier's core stack (impressions/creative/campaign-mgr/analytics/etc.), so they
// are what "make all the revenue streams part of tiers 1–3."
const CATALOG: AdvertiserFeatureDef[] = [
  // ── Tier 1 add-ons (entry; live in-model) ───────────────────────────────────────────────────────────────
  { key: "sponsored_survey_campaign", name: "Sponsored survey / quiz campaign", tier: 1, base_value_usd: 2400, revenue_type: "advertising", status: "live", category: 1, basis: "branded survey placement, conventional sponsored-content rate" },
  { key: "audience_pulse", name: "Audience pulse (targeted mini-panel)", tier: 1, base_value_usd: 6000, revenue_type: "audience_panel", status: "live", category: 5, basis: "one small targeted panel/yr at conventional research rates" },
  { key: "in_app_interstitials", name: "In-app full-screen ad placements", tier: 1, base_value_usd: 2000, revenue_type: "advertising", status: "live", gate_flag: "IN_APP_ADS_ENABLED", category: 1, basis: "premium interstitial inventory" },
  { key: "lead_gen_program", name: "Lead / referral fee program", tier: 1, base_value_usd: 1500, revenue_type: "lead_fee", status: "live", category: 6, basis: "qualified-lead routing to the advertiser" },

  // ── Tier 2 "Scale" add-ons ──────────────────────────────────────────────────────────────────────────────
  { key: "audience_panels_pro", name: "Audience panels — Pro (5/yr)", tier: 2, base_value_usd: 60000, revenue_type: "audience_panel", status: "live", category: 5, basis: "5 full audience panels/yr, conventional research rates" },
  { key: "brand_lift_studies", name: "Brand-lift studies (3/yr)", tier: 2, base_value_usd: 18000, revenue_type: "audience_panel", status: "live", category: 5, basis: "3 brand-lift studies/yr" },
  { key: "competitive_reports", name: "Competitive / category insight reports (6/yr)", tier: 2, base_value_usd: 15000, revenue_type: "audience_panel", status: "live", category: 5, basis: "6 competitive reports/yr" },
  { key: "offerwall_cpa", name: "Offerwall / CPA campaign", tier: 2, base_value_usd: 24000, revenue_type: "advertising", status: "gated", gate_flag: "OFFERWALL_CPA_ENABLED", category: 1, basis: "CPA offerwall placement (activates when an offerwall network is connected)" },
  { key: "rewarded_video", name: "Rewarded-video campaign", tier: 2, base_value_usd: 18000, revenue_type: "advertising", status: "gated", gate_flag: "REWARDED_VIDEO_ENABLED", category: 1, basis: "rewarded-video inventory (activates when a video ad-network SDK is connected)" },
  { key: "sponsored_push_email", name: "Sponsored push / email placement", tier: 2, base_value_usd: 9000, revenue_type: "advertising", status: "gated", gate_flag: "SPONSORED_PUSH_EMAIL_ENABLED", category: 1, basis: "sponsored message in push/email (activates with send-infra sign-off)" },
  { key: "api_access", name: "Data / reporting API access", tier: 2, base_value_usd: 12000, revenue_type: "white_label", status: "gated", gate_flag: "API_ACCESS_ENABLED", category: 5, basis: "metered API access (activates when key issuance is turned on)" },
  { key: "ai_creative_saas", name: "AI creative studio (self-serve)", tier: 2, base_value_usd: 12000, revenue_type: "dev_creator_cut", status: "gated", gate_flag: "AI_CREATIVE_SAAS_ENABLED", category: 5, basis: "self-serve AI creative generation (activates when the SaaS meter is on)" },

  // ── Tier 3 "Unlimited" add-ons ──────────────────────────────────────────────────────────────────────────
  { key: "product_testing_panel", name: "Product-testing panel", tier: 3, base_value_usd: 30000, revenue_type: "audience_panel", status: "gated", gate_flag: "PRODUCT_TESTING_PANEL_ENABLED", category: 5, basis: "managed product-testing panel" },
  { key: "white_label_raas", name: "White-label / Rewards-as-a-Service", tier: 3, base_value_usd: 60000, revenue_type: "white_label", status: "gated", gate_flag: "MULTITENANCY_ENABLED", category: 7, basis: "white-label tenant (activates when a tenant is provisioned)" },
  { key: "survey_routing_arbitrage", name: "Survey-routing arbitrage access", tier: 3, base_value_usd: 12000, revenue_type: "arbitrage_margin", status: "gated", gate_flag: "SURVEY_ROUTING_ARBITRAGE_ENABLED", category: 6, basis: "priority survey-routing (activates when a partner router is connected)" },
];

function valueOverrides(): Record<string, number> {
  try { const o = JSON.parse(snapString("ADVERTISER_FEATURE_CATALOG_JSON", "") || "{}"); return (o && typeof o === "object") ? o as Record<string, number> : {}; }
  catch { return {}; }
}

export interface AdvertiserFeatureView extends AdvertiserFeatureDef {
  value_usd: number;    // effective conventional value (override or base)
  live: boolean;        // delivering now? (status live, or gated/counsel with its flag ON)
  delivered_value_usd: number; // value COUNTED toward the tier's delivered stack (0 unless live)
  readiness_note: string;
}

/** A feature is "live" (delivering) when its status is live, or when a gated/counsel feature's flag is ON. */
export function featureIsLive(def: AdvertiserFeatureDef): boolean {
  if (def.status === "live") return def.gate_flag ? snapBool(def.gate_flag, true) : true;
  return def.gate_flag ? snapBool(def.gate_flag, false) : false;
}

export function advertiserFeatureCatalog(): AdvertiserFeatureView[] {
  const ov = valueOverrides();
  return CATALOG.map((d) => {
    const value = Math.max(0, Number(ov[d.key] ?? d.base_value_usd) || 0);
    const live = featureIsLive(d);
    return {
      ...d,
      value_usd: value,
      live,
      delivered_value_usd: live ? value : 0,
      readiness_note: live ? "live — delivering now"
        : d.status === "counsel" ? "included — activates after counsel sign-off"
        : "included — activates when its account/prerequisite is connected",
    };
  });
}

/** Which catalog features a given context includes. Founding/pre-revenue Tier 1 gets EVERYTHING (all tiers);
 *  a standard tier gets its own tier and below. */
export function featuresForContext(tier: FeatureTier, opts?: { founding?: boolean }): AdvertiserFeatureView[] {
  const all = advertiserFeatureCatalog();
  if (opts?.founding) return all;                 // founding privilege: the whole catalog, free
  return all.filter((f) => f.tier <= tier);       // standard: this tier and below
}

export interface TierFeatureRollup {
  tier: FeatureTier;
  founding: boolean;
  price_usd: number;
  features: AdvertiserFeatureView[];
  live_count: number;
  pending_count: number;
  added_delivered_value_usd: number;   // live features' value — what the ratio climb is built on
  added_listed_value_usd: number;      // all included features' conventional value (live + pending)
}

/** The catalog value LAYERED onto a tier — additive, holding the price. `added_delivered_value_usd` is what a
 *  combined value stack would add to the tier total (so the delivered-value ratio climbs); pending (gated/
 *  counsel) features are listed but add $0 until live. This does NOT mutate the tested tier value stacks. */
export function tierFeatureRollup(tier: FeatureTier, opts?: { founding?: boolean; priceUsd?: number }): TierFeatureRollup {
  const features = featuresForContext(tier, opts);
  const live = features.filter((f) => f.live);
  return {
    tier,
    founding: !!opts?.founding,
    price_usd: Math.max(0, Number(opts?.priceUsd ?? foundingPriceUsd()) || 0),
    features,
    live_count: live.length,
    pending_count: features.length - live.length,
    added_delivered_value_usd: Math.round(live.reduce((s, f) => s + f.delivered_value_usd, 0) * 100) / 100,
    added_listed_value_usd: Math.round(features.reduce((s, f) => s + f.value_usd, 0) * 100) / 100,
  };
}

/** Map a RevenueEvent `type` back to the catalog feature keys that book to it (for the per-tier revenue view). */
export function featureKeysForRevenueType(type: string): string[] {
  return CATALOG.filter((d) => d.revenue_type === type).map((d) => d.key);
}
