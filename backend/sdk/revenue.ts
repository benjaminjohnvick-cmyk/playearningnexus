// revenue.ts — the platform's non-customer revenue layer.
//
// PHILOSOPHY: the customer never pays a markup. Every stream here earns from BUSINESSES (advertisers,
// sellers, sponsors, brands, developers) or from structural margin (breakage, negotiated spreads) — never
// from a markup added to a customer's price. Every earned dollar is written to ONE ledger (RevenueEvent)
// via recordRevenue(), so the admin has a single source of truth across all streams and can prove the
// business side out-earns the retired markup many times over.
//
// Implements the owner-selected streams:
//   A1 AdGrid funds all discounts · A2 seller-side commission · A3 sponsored placement · A4 sourcing margin
//   A5 affiliate commission · A6 business signup/onboarding fee · A7 B2B SaaS tiers · A10 lead/referral fee
//   A11 co-op marketing funds · A12 processing rebate
//   B13 advertising · B14 breakage · B15 sponsored jackpots · B16 dev/creator cut · B17 white-label/API
//   B18 BNPL merchant fee · B19 premium membership fee (existing) · B20 gift-card/catalog arbitrage
//   B22 shipping spread · B23 audience segments/panels

import { db } from "./db.ts";
import { snapNumber, snapBool, snapString } from "./settings.ts";
import { round2 } from "./premium-ppc.ts";

export type RevenueType =
  | "grid_fee" | "seller_commission" | "sponsored_placement" | "sourcing_margin" | "affiliate_commission"
  | "business_signup" | "business_onboarding" | "business_subscription" | "lead_fee" | "coop_fund"
  | "processing_rebate" | "advertising" | "breakage" | "sponsored_prize" | "dev_creator_cut"
  | "white_label" | "bnpl_merchant_fee" | "membership_fee" | "arbitrage_margin" | "shipping_margin"
  | "audience_panel" | "other";

/** Record ONE non-customer REVENUE event (real money in) into the unified ledger. */
export async function recordRevenue(input: {
  type: RevenueType;
  amount_usd: number;
  business_id?: string | null;
  user_id?: string | null;
  ref?: string | null;
  meta?: Record<string, unknown>;
}): Promise<string | null> {
  return writeEvent("revenue", input);
}

/** Record a SUBSIDY (a perk the platform funds — e.g. seller cash-back points), so it's tracked as a COST
 *  against breakage + the advertiser pool without inflating revenue. Same ledger, kind:"subsidy". */
export async function recordSubsidy(input: {
  type: RevenueType;
  amount_usd: number;
  business_id?: string | null;
  user_id?: string | null;
  ref?: string | null;
  funded_by?: string;
  meta?: Record<string, unknown>;
}): Promise<string | null> {
  return writeEvent("subsidy", { ...input, meta: { ...(input.meta ?? {}), funded_by: input.funded_by ?? "breakage+advertiser_pool" } });
}

async function writeEvent(kind: "revenue" | "subsidy", input: {
  type: RevenueType; amount_usd: number; business_id?: string | null; user_id?: string | null; ref?: string | null; meta?: Record<string, unknown>;
}): Promise<string | null> {
  const amount = round2(Math.max(0, Number(input.amount_usd) || 0));
  if (amount <= 0) return null;
  try {
    const row = await db.create("RevenueEvent", {
      kind,                          // "revenue" (money in) or "subsidy" (platform-funded perk / cost)
      type: input.type,
      amount_usd: amount,
      business_id: input.business_id ?? null,
      user_id: input.user_id ?? null,
      ref: input.ref ?? null,
      customer_paid: false,          // INVARIANT: nothing here is a markup charged to a customer
      meta: input.meta ?? {},
      at: new Date().toISOString(),
    });
    return (row as Record<string, unknown>)?.id as string ?? null;
  } catch { return null; }
}

// ── Config knobs (all admin-tunable; safe zero/off defaults so nothing bills until you set it) ──────────
// A1 — let the advertiser/loyalty revenue pool fund the discount for EVERY user (not just premium).
export const adgridFundsAllDiscounts = () => snapBool("ADGRID_FUNDS_ALL_DISCOUNTS", false);
// A2 — marketplace platform commission, charged to the SELLER (out of their proceeds), never the buyer.
export const sellerCommissionPct = () => Math.min(1, Math.max(0, snapNumber("MARKETPLACE_SELLER_COMMISSION_PCT", 0.10)));
// Suggestion 1 — how the platform takes its marketplace margin:
//   "cashback" (default) → seller keeps 100% AND gets cash-back points; margin funded by breakage + pool.
//   "seller"             → platform commission taken from the seller's proceeds (A2).
//   "off"                → seller keeps 100%, no cash-back, no commission.
export const marketplaceMarginSource = () => {
  const v = snapString("MARKETPLACE_MARGIN_SOURCE", "cashback").toLowerCase();
  return v === "seller" || v === "off" ? v : "cashback";
};
// Cash-back points granted to the seller (they keep 100% of the sale AND get this back). Closed-loop scrip.
export const sellerCashbackPointsPct = () => Math.min(1, Math.max(0, snapNumber("SELLER_CASHBACK_POINTS_PCT", 0.10)));
// Gate: hold the seller's cash-back as LOCKED points until the seller signs up to use the site as a USER
// (one-click seller onboarding, agreeing to seller + user for a year). Keeps the perk inside the closed
// loop — the seller can only spend the cash-back by using the platform, which is the whole point of it.
export const sellerCashbackRequiresActivation = () => snapBool("SELLER_CASHBACK_REQUIRES_ACTIVATION", true);
// Length (months) of the seller+user commitment captured at one-click activation. Default 12 = one year.
export const sellerUserCommitmentMonths = () => Math.max(1, Math.round(snapNumber("SELLER_USER_COMMITMENT_MONTHS", 12)));
// Suggestion 3 — default wholesale fraction for platform-catalog items when no explicit wholesale cost is
// set (0.90 → wholesale ≈ 90% of face, so ~10% is the sourcing spread the platform keeps at redemption).
export const catalogWholesaleFraction = () => Math.min(1, Math.max(0, snapNumber("CATALOG_WHOLESALE_FRACTION", 0.90)));
// A3/B13 — sponsored placement / ad slot price (per placement period).
export const sponsoredPlacementPriceUsd = () => round2(Math.max(0, snapNumber("SPONSORED_PLACEMENT_PRICE_USD", 0)));
// A6 — business sign-up + one-time onboarding fee.
export const businessSignupFeeUsd = () => round2(Math.max(0, snapNumber("BUSINESS_SIGNUP_FEE_USD", 0)));
export const businessOnboardingFeeUsd = () => round2(Math.max(0, snapNumber("BUSINESS_ONBOARDING_FEE_USD", 0)));
// A7 — B2B SaaS monthly tiers.
export const saasTierPriceUsd = (tier: string) => {
  const key = tier === "enterprise" ? "BUSINESS_SAAS_ENTERPRISE_USD" : tier === "pro" ? "BUSINESS_SAAS_PRO_USD" : "BUSINESS_SAAS_BASIC_USD";
  const dflt = tier === "enterprise" ? 999 : tier === "pro" ? 299 : 49;
  return round2(Math.max(0, snapNumber(key, dflt)));
};
// A10 — lead/referral fee when the platform sends a customer to a business (flat + %).
export const leadFeeUsd = () => round2(Math.max(0, snapNumber("LEAD_REFERRAL_FEE_USD", 0)));
export const leadFeePct = () => Math.min(1, Math.max(0, snapNumber("LEAD_REFERRAL_FEE_PCT", 0)));
// A12 — payment-processing rebate share (recorded when a processor rebates volume).
export const processingRebatePct = () => Math.min(1, Math.max(0, snapNumber("PROCESSING_REBATE_PCT", 0)));
// B16 — platform cut on developer/creator payouts.
export const devCreatorCutPct = () => Math.min(1, Math.max(0, snapNumber("DEV_CREATOR_PLATFORM_CUT_PCT", 0.20)));
// B18 — BNPL (Affirm) merchant fee recorded as platform revenue on a financed order.
export const bnplMerchantFeePct = () => Math.min(1, Math.max(0, snapNumber("BNPL_MERCHANT_FEE_PCT", 0)));
// B23 — price to run a survey/campaign against a targeted audience segment.
export const audiencePanelPriceUsd = () => round2(Math.max(0, snapNumber("AUDIENCE_PANEL_PRICE_USD", 0)));
// B14 — breakage RECOGNITION rate for reporting (fraction of outstanding closed-loop points assumed never
// redeemed). Reporting-only estimate; not a booking of real cash.
export const breakageRecognitionPct = () => Math.min(1, Math.max(0, snapNumber("BREAKAGE_RECOGNITION_PCT", 0.15)));
export const pointValueUsd = () => Math.max(0.0001, (snapNumber("POINT_VALUE_CENTS", 1) || 1) / 100);

/** Commission taken from a SELLER's sale proceeds (A2). Returns the platform's cut and the seller's net. */
export function splitSellerProceeds(saleUsd: number): { platform_usd: number; seller_usd: number; pct: number } {
  const pct = sellerCommissionPct();
  const gross = Math.max(0, Number(saleUsd) || 0);
  const platform = round2(gross * pct);
  return { platform_usd: platform, seller_usd: round2(gross - platform), pct };
}

/** Lead/referral fee for sending a customer to a business on an order of `orderUsd` (A10). */
export function computeLeadFee(orderUsd: number): number {
  return round2(leadFeeUsd() + Math.max(0, Number(orderUsd) || 0) * leadFeePct());
}
