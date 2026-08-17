// ai-ad-manager.ts — the dedicated AI system that DELIVERS the Tier 2 "Scale" package (options A–D) with no
// per-advertiser human staffing. Every deliverable is mapped to an existing AI engine that already runs on the
// platform, so the package is self-serving at near-zero marginal cost. See TIER2-AI-MANAGEMENT-AND-RATE-CARD.md.
//
// TWO HONESTY RULES are baked in (they keep the $200k value real rather than deceptive):
//   1. Research (audience panels, brand-lift) is fielded to REAL, CONSENTED respondents via createAudiencePanel
//      and analyzed by AI — the value is real human responses, never an AI-fabricated "study".
//   2. The account-management line is labeled as an AI CAMPAIGN MANAGER (always-on), not a "dedicated success
//      manager" — an AI agent is a real product, but it is not a human, so it isn't sold as one. Its full value
//      assumes optional human escalation is available; pure-AI-only would carry a lower value.
import { snapNumber, snapString, snapBool } from "./settings.ts";
import { isEnabled } from "./feature-flags.ts";

export const aiAdManagerEnabled = () => snapBool("AI_AD_MANAGER_ENABLED", true);
export async function aiAdManagerLive(jurisdiction?: string | null): Promise<boolean> {
  return aiAdManagerEnabled() && await isEnabled("ai_ad_manager", jurisdiction ?? null).catch(() => true);
}

export type DeliverableGroup = "A_media" | "B_creative" | "C_research" | "D_service";

export interface Deliverable {
  key: string;
  group: DeliverableGroup;
  name: string;
  annual_value_usd: number;   // conventional market list value of this line
  qty_per_year: number | null;// units/yr where it's a countable deliverable (null = continuous)
  ai_served: boolean;         // delivered by the AI system with no per-advertiser human labor
  engine: string;             // the existing platform function/system that produces it
  cadence: "continuous" | "monthly" | "quarterly" | "semiannual" | "bimonthly";
  real_respondents?: boolean; // research lines: fielded to real consented users (value = real responses)
  basis: string;              // why this value is conventional/defensible
}

// The A–D catalog. Values are conventional market rates (see the rate-card doc); each is admin-tunable via
// TIER2_RATE_CARD_JSON (a {key: annual_value_usd} override map). Engines are real, existing platform functions.
const CATALOG: Deliverable[] = [
  // A. Advertising media
  { key: "between_survey_impressions", group: "A_media", name: "Between-survey interstitial impressions (3,000,000/yr)", annual_value_usd: 66000, qty_per_year: 3000000, ai_served: true, engine: "adGridFeed", cadence: "continuous", basis: "~$22 CPM, premium high-attention first-party in-app inventory" },
  { key: "video_views", group: "A_media", name: "Rewarded / in-survey video views (500,000/yr)", annual_value_usd: 9000, qty_per_year: 500000, ai_served: true, engine: "adGridFeed", cadence: "continuous", basis: "~$18 CPM video" },
  { key: "homepage_featured", group: "A_media", name: "Homepage & category featured placement", annual_value_usd: 15000, qty_per_year: null, ai_served: true, engine: "createAdGridAd", cadence: "continuous", basis: "fixed premium placement (~$1,250/mo)" },
  { key: "sponsor_wall", group: "A_media", name: "Premier sponsor-wall / category-priority placement", annual_value_usd: 9000, qty_per_year: null, ai_served: true, engine: "createAdGridAd", cadence: "continuous", basis: "sponsorship / priority premium" },
  // B. Creative & content production
  { key: "managed_ad_creative", group: "B_creative", name: "Managed ad-creative production (display/native, monthly refresh)", annual_value_usd: 12000, qty_per_year: 12, ai_served: true, engine: "aiCreativeContentGeneator", cadence: "monthly", basis: "AI creative generation (agency-retainer equivalent, AI-priced)" },
  { key: "social_ad_posts", group: "B_creative", name: "Managed social ad posts (1,200/yr)", annual_value_usd: 15000, qty_per_year: 1200, ai_served: true, engine: "autoPostContentToSocial", cadence: "monthly", basis: "managed social content" },
  { key: "email_campaigns", group: "B_creative", name: "Dedicated email campaigns to opted-in audience (12/yr)", annual_value_usd: 9000, qty_per_year: 12, ai_served: true, engine: "autoEmailSequenceEngine", cadence: "monthly", basis: "email marketing service" },
  { key: "sponsored_newsletters", group: "B_creative", name: "Sponsored newsletter placements (6/yr)", annual_value_usd: 9000, qty_per_year: 6, ai_served: true, engine: "autoEmailSequenceEngine", cadence: "bimonthly", basis: "~$1,500 each" },
  // C. Research, data & insights
  { key: "audience_panels", group: "C_research", name: "Custom audience-panel research studies (4/yr)", annual_value_usd: 48000, qty_per_year: 4, ai_served: true, engine: "createAudiencePanel", cadence: "quarterly", real_respondents: true, basis: "~$12,000 each; AI-designed & analyzed, fielded to REAL consented respondents" },
  { key: "brand_lift_studies", group: "C_research", name: "Brand-lift / ad-effectiveness studies (2/yr)", annual_value_usd: 12000, qty_per_year: 2, ai_served: true, engine: "createAudiencePanel", cadence: "semiannual", real_respondents: true, basis: "~$6,000 each; exposed/control measured on REAL respondents" },
  { key: "competitive_reports", group: "C_research", name: "Category & competitive insights reports (quarterly)", annual_value_usd: 10000, qty_per_year: 4, ai_served: true, engine: "aiStrategicInsightsEngine", cadence: "quarterly", basis: "~$2,500 each; AI synthesis of first-party + category data" },
  { key: "data_feed_api", group: "C_research", name: "First-party audience data feed + API access", annual_value_usd: 12000, qty_per_year: null, ai_served: true, engine: "platformInsights", cadence: "continuous", basis: "aggregate, consent-gated data-product access" },
  // D. Managed service, analytics & optimization
  { key: "ai_campaign_manager", group: "D_service", name: "Always-on AI campaign manager + optimization (human escalation available)", annual_value_usd: 42000, qty_per_year: null, ai_served: true, engine: "aiAdCampaignOptimizer", cadence: "continuous", basis: "AI campaign management with optional human escalation; NOT sold as a dedicated human" },
  { key: "analytics_dashboard", group: "D_service", name: "Advanced analytics & attribution dashboard", annual_value_usd: 8400, qty_per_year: null, ai_served: true, engine: "aiSurveyInsightsDashboard", cadence: "continuous", basis: "~$700/mo SaaS-equivalent" },
  { key: "ab_testing", group: "D_service", name: "Multivariate / A-B testing program", annual_value_usd: 6000, qty_per_year: null, ai_served: true, engine: "abTestAssigner", cadence: "continuous", basis: "testing tooling + AI analysis" },
];

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Apply the optional TIER2_RATE_CARD_JSON override ({key: annual_value_usd}) onto the catalog. */
export function catalog(): Deliverable[] {
  let overrides: Record<string, number> = {};
  try { overrides = JSON.parse(snapString("TIER2_RATE_CARD_JSON", "{}") || "{}"); } catch { overrides = {}; }
  return CATALOG.map((d) => (overrides[d.key] != null ? { ...d, annual_value_usd: Math.max(0, Number(overrides[d.key]) || 0) } : d));
}

export interface RateCard {
  groups: { group: DeliverableGroup; label: string; items: Deliverable[]; subtotal_usd: number }[];
  list_value_usd: number;     // sum of conventional list values (A–D)
  bundle_price_usd: number;   // what it actually sells for (Tier 2 price)
  bundle_discount_pct: number;// implied discount off list
  fully_ai_served: boolean;   // true = every line is delivered by the AI system
  price_covered: boolean;     // list value ≥ bundle price
}

const GROUP_LABEL: Record<DeliverableGroup, string> = {
  A_media: "A. Advertising media",
  B_creative: "B. Creative & content production",
  C_research: "C. Research, data & insights",
  D_service: "D. Managed service, analytics & optimization",
};

/** The full A–D rate card with per-group subtotals, list value, and the implied bundle discount vs the
 *  Tier 2 price. `bundlePriceUsd` is passed in (the live Tier 2 price) so the two never drift. */
export function rateCard(bundlePriceUsd: number): RateCard {
  const items = catalog();
  const groupsOrder: DeliverableGroup[] = ["A_media", "B_creative", "C_research", "D_service"];
  const groups = groupsOrder.map((g) => {
    const gi = items.filter((d) => d.group === g);
    return { group: g, label: GROUP_LABEL[g], items: gi, subtotal_usd: round2(gi.reduce((s, d) => s + d.annual_value_usd, 0)) };
  });
  const list = round2(groups.reduce((s, g) => s + g.subtotal_usd, 0));
  const price = Math.max(0, Number(bundlePriceUsd) || 0);
  return {
    groups,
    list_value_usd: list,
    bundle_price_usd: price,
    bundle_discount_pct: list > 0 ? round2(Math.max(0, (list - price) / list)) : 0,
    fully_ai_served: items.every((d) => d.ai_served),
    price_covered: list >= price,
  };
}

export interface PlannedDeliverable extends Deliverable {
  qty_delivered_ytd: number | null; // proportional to parts completed
  value_delivered_usd: number;      // proportional value recognized so far
}

/** What the AI system has delivered so far given parts completed (0..parts). Value + quantities pro-rate
 *  across the 12 parts, exactly like tier2Deliverables — continuous lines are "active" once part 1 is bought. */
export function deliveryPlan(partsCompleted: number, parts: number): PlannedDeliverable[] {
  const done = Math.max(0, Math.min(parts, Math.floor(Number(partsCompleted) || 0)));
  const frac = parts > 0 ? done / parts : 0;
  return catalog().map((d) => ({
    ...d,
    qty_delivered_ytd: d.qty_per_year == null ? null : Math.round(d.qty_per_year * frac),
    value_delivered_usd: round2(d.annual_value_usd * (d.qty_per_year == null ? (done >= 1 ? 1 : 0) : frac)),
  }));
}

/** Dispatch manifest: the due deliverables and which engine serves each, for the self-serve orchestrator. */
export function dispatchManifest(partsCompleted: number, parts: number): { key: string; engine: string; cadence: string; real_respondents: boolean }[] {
  const done = Math.max(0, Math.floor(Number(partsCompleted) || 0));
  if (done < 1) return [];
  return catalog().map((d) => ({ key: d.key, engine: d.engine, cadence: d.cadence, real_respondents: !!d.real_respondents }));
}
