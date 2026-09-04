// revenue-levers.ts — the governance registry for EVERY monetization sub-point across all 8 categories.
//
// This is the single source of truth for "what revenue streams exist, and what state is each in." It does NOT
// itself charge anyone or bypass any gate — each lever still obeys its own setting / KYC / counsel flag. It
// exists so the admin (and the expansion doc) can see, in one place, every sub-point of all 8 categories and
// whether it is BUILT (live & wired), GATED (scaffold/settings present, safe-OFF, needs a third-party account
// before it can earn), or COUNSEL (deliberately not built pending an attorney).
//
// `status` meanings:
//   built   — code-complete and wired into the ledger; earns as soon as its own setting is on.
//   gated   — the platform-side code/settings exist and are safe-OFF; it needs an external account (ad network,
//             affiliate network, supplier API, key issuance) connected before it can actually earn.
//   counsel — intentionally NOT built; would break the closed loop or invite a regulated classification.
import { snapBool } from "./settings.ts";

export const revenueLeversRegistryEnabled = () => snapBool("REVENUE_LEVERS_REGISTRY_ENABLED", true);

export type LeverStatus = "built" | "gated" | "counsel";
export interface RevenueLeverDef {
  key: string;
  category: number;          // 1..8
  name: string;
  status: LeverStatus;
  ledger_type?: string;      // the RevenueEvent `type` it books to, when applicable
  setting_key?: string;      // the specific setting that gates it, when applicable
  enable_flag?: string;      // for gated/counsel: the sensitive *_ENABLED wizard flag that unlocks it
  needs?: string;            // for gated: what external thing must be connected
  note?: string;
}

/** Has the admin switched a gated/counsel lever ON in the Setup Wizard? (It still needs its external account
 *  or counsel build to actually earn — this only reports the flag.) Levers with no enable_flag return false. */
export function leverConfiguredOn(def: RevenueLeverDef): boolean {
  return def.enable_flag ? snapBool(def.enable_flag, false) : false;
}

// The full map. Categories: 1 Advertising · 2 Commerce · 3 Subscriptions · 4 Closed-loop virtual economy ·
// 5 Data/B2B · 6 Performance/lead-gen · 7 Platform · 8 Fees.
export const REVENUE_LEVERS: RevenueLeverDef[] = [
  // 1 — Advertising (the hub)
  { key: "sponsored_placement", category: 1, name: "Sponsored placement / ad slots", status: "built", ledger_type: "sponsored_placement", setting_key: "SPONSORED_PLACEMENT_PRICE_USD" },
  { key: "ppc_grid", category: 1, name: "Advertiser PPC grid (+ auto-renew, SCA/3DS)", status: "built", ledger_type: "advertising" },
  { key: "sponsored_surveys", category: 1, name: "Sponsored surveys / quizzes", status: "built", ledger_type: "advertising" },
  { key: "sponsored_jackpots", category: 1, name: "Sponsored jackpots / prizes", status: "built", ledger_type: "sponsored_prize" },
  { key: "in_app_ads", category: 1, name: "In-app full-screen ads", status: "built", ledger_type: "advertising", setting_key: "IN_APP_ADS_ENABLED" },
  { key: "offerwall_cpa", category: 1, name: "Offerwall / CPA wall", status: "gated", enable_flag: "OFFERWALL_CPA_ENABLED", ledger_type: "advertising", needs: "an offerwall/CPA network + your publisher account" },
  { key: "rewarded_video", category: 1, name: "Rewarded video", status: "gated", enable_flag: "REWARDED_VIDEO_ENABLED", ledger_type: "advertising", needs: "a rewarded-video ad-network SDK + publisher account" },
  { key: "sponsored_push_email", category: 1, name: "Sponsored push / email", status: "gated", enable_flag: "SPONSORED_PUSH_EMAIL_ENABLED", ledger_type: "advertising", needs: "a paying sponsor + send-infrastructure sign-off" },
  { key: "earn_hook_rewarded_ads", category: 1, name: "Mobile earn hook → in-app rewarded ads", status: "counsel", enable_flag: "EARN_HOOK_ENABLED", ledger_type: "advertising", note: "One-tap-to-earn widget + user-scheduled reminder → user-initiated in-app rewarded ad; closed-loop points. Needs a rewarded-ad network + counsel. See EARN-HOOK-AND-REMINDER-COMPLIANT-DESIGN.md." },

  // 2 — Commerce
  { key: "seller_commission", category: 2, name: "Marketplace seller commission / cash-back margin", status: "built", ledger_type: "seller_commission", setting_key: "MARKETPLACE_SELLER_COMMISSION_PCT" },
  { key: "sourcing_margin", category: 2, name: "Sourcing / wholesale spread on fulfillment", status: "built", ledger_type: "sourcing_margin", setting_key: "CATALOG_WHOLESALE_FRACTION" },
  { key: "curator_resale", category: 2, name: "Curator resale reward (user resells catalog item)", status: "built", ledger_type: "curator_reward", setting_key: "CURATOR_REWARD_POINTS_PCT" },
  { key: "seller_listing_fees", category: 2, name: "Seller listing / promo fees", status: "built", ledger_type: "business_signup" },
  { key: "affiliate_storefront", category: 2, name: "Affiliate storefront", status: "gated", enable_flag: "AFFILIATE_STOREFRONT_ENABLED", ledger_type: "affiliate_commission", needs: "an affiliate network account + tracking links" },
  { key: "print_on_demand", category: 2, name: "Print-on-demand goods", status: "gated", enable_flag: "PRINT_ON_DEMAND_ENABLED", ledger_type: "sourcing_margin", needs: "a POD supplier API account" },
  { key: "group_buying", category: 2, name: "Group buying", status: "gated", enable_flag: "GROUP_BUYING_ENABLED", ledger_type: "sourcing_margin", needs: "a group-buy supplier + escrow terms" },

  // 3 — Subscriptions
  { key: "premium_membership", category: 3, name: "Premium membership (+ compliant auto-renew)", status: "built", ledger_type: "membership_fee" },
  { key: "b2b_saas_tiers", category: 3, name: "B2B SaaS tiers (basic/pro/enterprise)", status: "built", ledger_type: "business_subscription" },
  { key: "paid_ad_free", category: 3, name: "Paid ad-free / boosts", status: "built", setting_key: "PREMIUM_ADFREE_ENABLED", ledger_type: "membership_fee" },
  { key: "family_plan", category: 3, name: "Family plan", status: "gated", enable_flag: "FAMILY_PLAN_ENABLED", ledger_type: "membership_fee", needs: "a priced family SKU + seat management" },
  { key: "pro_tools", category: 3, name: "Pro tools add-on", status: "gated", enable_flag: "PRO_TOOLS_ENABLED", ledger_type: "membership_fee", needs: "a priced add-on SKU" },

  // 4 — Closed-loop virtual economy (all fully buildable in-model)
  { key: "cosmetics_store", category: 4, name: "Cosmetics store (frames/themes/flair/nameplates/effects)", status: "built", ledger_type: "breakage", setting_key: "COSMETICS_ENABLED" },
  { key: "gift_boost_platform_funded", category: 4, name: "Gift/boost — PLATFORM-FUNDED (no wallet-to-wallet move)", status: "built", ledger_type: "breakage", setting_key: "GIFT_BOOST_MAX_USD", note: "The compliant default gift path (gift_boost): platform funds the recipient; no value moves between users." },
  { key: "site_cash_gifting", category: 4, name: "Direct Site-Cash gifting (user→user, p2p)", status: "counsel", enable_flag: "SITE_CASH_GIFTING_ENABLED", ledger_type: "breakage", note: "Moves value between user balances = p2p transfer (money-transmission risk). Gated OFF + counsel; also requires the p2p_transfers flag. Prefer the platform-funded gift/boost above." },
  { key: "earn_boosts", category: 4, name: "Earn boosts (deterministic Site-Cash multiplier)", status: "built", ledger_type: "breakage", setting_key: "EARN_BOOST_ENABLED" },
  { key: "season_pass", category: 4, name: "Season / battle pass (Site-Cash track of cosmetic rewards)", status: "gated", enable_flag: "SEASON_PASS_ENABLED", ledger_type: "breakage", needs: "a priced pass SKU + reward track (roadmap; cosmetics is the reference build)" },

  // 5 — Data / B2B insights
  { key: "audience_panels", category: 5, name: "Audience panels / targeted survey campaigns", status: "built", ledger_type: "audience_panel", setting_key: "AUDIENCE_PANEL_PRICE_USD" },
  { key: "insights_reports", category: 5, name: "Insights reports / brand-lift", status: "built", ledger_type: "audience_panel" },
  { key: "product_testing", category: 5, name: "Product-testing panels", status: "gated", enable_flag: "PRODUCT_TESTING_PANEL_ENABLED", ledger_type: "audience_panel", needs: "a paying brand + panel recruitment terms" },
  { key: "api_access", category: 5, name: "Sellable API access", status: "gated", enable_flag: "API_ACCESS_ENABLED", ledger_type: "white_label", needs: "API-key issuance + metering + a buyer" },
  { key: "ai_creative_saas", category: 5, name: "AI-creative-as-a-service", status: "gated", enable_flag: "AI_CREATIVE_SAAS_ENABLED", ledger_type: "dev_creator_cut", needs: "a priced creative SKU + a buyer" },

  // 6 — Performance / lead-gen
  { key: "lead_fee", category: 6, name: "Lead / referral fee to businesses", status: "built", ledger_type: "lead_fee", setting_key: "LEAD_REFERRAL_FEE_USD" },
  { key: "survey_routing_arbitrage", category: 6, name: "Survey-routing arbitrage", status: "gated", enable_flag: "SURVEY_ROUTING_ARBITRAGE_ENABLED", ledger_type: "arbitrage_margin", needs: "a partner survey router account" },
  { key: "financial_lead_gen", category: 6, name: "Financial lead-gen (loans/credit/insurance)", status: "counsel", enable_flag: "FINANCIAL_LEAD_GEN_ENABLED", note: "Regulated (licensing, UDAAP, state lending law). Not built — counsel first." },

  // 7 — Platform
  { key: "white_label_raas", category: 7, name: "White-label / rewards-as-a-service", status: "gated", enable_flag: "MULTITENANCY_ENABLED", ledger_type: "white_label", setting_key: "MULTITENANCY_ENABLED", needs: "per-tenant provisioning + a paying tenant" },
  { key: "hosting", category: 7, name: "Hosting / streaming monetization", status: "gated", enable_flag: "HOSTING_MONETIZATION_ENABLED", ledger_type: "white_label", needs: "moderation + DMCA agent + a decision to enable public streaming" },
  { key: "fraud_as_a_service", category: 7, name: "Fraud-detection-as-a-service", status: "gated", enable_flag: "FRAUD_SAAS_ENABLED", ledger_type: "white_label", needs: "productization of the internal fraud tooling + a buyer" },

  // 8 — Fees (structural, never a customer markup)
  { key: "processing_rebate", category: 8, name: "Payment-processing rebate share", status: "built", ledger_type: "processing_rebate", setting_key: "PROCESSING_REBATE_PCT" },
  { key: "bnpl_merchant_fee", category: 8, name: "BNPL merchant fee", status: "built", ledger_type: "bnpl_merchant_fee", setting_key: "BNPL_MERCHANT_FEE_PCT" },
  { key: "shipping_spread", category: 8, name: "Shipping spread", status: "built", ledger_type: "shipping_margin" },
  { key: "expedited_fulfillment", category: 8, name: "Expedited-fulfillment fee", status: "gated", enable_flag: "EXPEDITED_FULFILLMENT_ENABLED", ledger_type: "shipping_margin", needs: "a priced expedite SKU" },
  { key: "partner_payout_fee", category: 8, name: "Partner payout fee", status: "gated", enable_flag: "PARTNER_PAYOUT_FEE_ENABLED", ledger_type: "other", needs: "the payout rail live (KYC-gated) before a fee applies" },
  { key: "fx_spread", category: 8, name: "FX spread", status: "counsel", enable_flag: "FX_SPREAD_ENABLED", note: "Only relevant once real-money cross-border flows exist; keep OFF pending counsel." },
];

export const CATEGORY_NAMES: Record<number, string> = {
  1: "Advertising (the hub)", 2: "Commerce", 3: "Subscriptions", 4: "Closed-loop virtual economy",
  5: "Data / B2B insights", 6: "Performance / lead-gen", 7: "Platform", 8: "Fees (structural)",
};

/** Roll the registry up into per-category and overall counts, for the admin status page. */
export function summarizeLevers() {
  const by: Record<number, { name: string; built: number; gated: number; counsel: number; total: number; levers: RevenueLeverDef[] }> = {};
  for (let c = 1; c <= 8; c++) by[c] = { name: CATEGORY_NAMES[c], built: 0, gated: 0, counsel: 0, total: 0, levers: [] };
  for (const l of REVENUE_LEVERS) {
    const b = by[l.category]; if (!b) continue;
    b[l.status]++; b.total++; b.levers.push(l);
  }
  const totals = { built: 0, gated: 0, counsel: 0, total: REVENUE_LEVERS.length };
  for (const l of REVENUE_LEVERS) totals[l.status]++;
  return { categories: by, totals };
}
