// revenue-stack.ts — the BLENDED $200k/year revenue-stack model, projected over 5 years, per customer.
//
// This is a REPORTING / PLANNING layer on top of the unified RevenueEvent ledger (see revenue.ts). It
// NEVER moves money, bills a customer, or promises a return — it reads what has already been recorded and
// measures it against the owner's target blend. The whole point of the discussion it implements:
//   • $200k/year is a STACK — the sum of every business-funded line, not a single product.
//   • PPC advertiser LTV stays $12,000; PPC ("advertising") is just ONE line in the blend.
//   • Each business CUSTOMER has a 5-year value = their trailing run-rate annualized × the horizon.
//   • "Results" is the spine: lines split into SALES-DRIVEN (you sign them) vs ACTIVITY-DRIVEN (minted by
//     member engagement), so the activity floor de-risks the target.
// See REVENUE-STACK-MODEL.md and ADVERTISER-PRICING-2026.md.

import { snapNumber, snapString } from "./settings.ts";
import type { RevenueType } from "./revenue.ts";

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const clampYears = (y: number) => Math.max(1, Math.min(25, Math.round(y)));

// ── Settings getters ────────────────────────────────────────────────────────────────────────────────────
export const revenueStackAnnualTargetUsd = () => Math.max(0, snapNumber("REVENUE_STACK_ANNUAL_TARGET_USD", 200000));
export const revenueStackHorizonYears = () => clampYears(snapNumber("REVENUE_STACK_HORIZON_YEARS", 5));
export const customerValueHorizonYears = () => clampYears(snapNumber("CUSTOMER_VALUE_HORIZON_YEARS", 5));

/** The admin-tunable target blend: RevenueEvent type → annual $ target. Falls back to a sane default that
 *  sums to $200k if the setting is missing or unparseable. */
export function stackTargetBlend(): Record<string, number> {
  const raw = snapString("REVENUE_STACK_TARGET_BLEND", "");
  if (raw) {
    try {
      const obj = JSON.parse(raw) as Record<string, unknown>;
      const out: Record<string, number> = {};
      for (const [k, v] of Object.entries(obj)) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0) out[k] = r2(n);
      }
      if (Object.keys(out).length) return out;
    } catch { /* fall through to default */ }
  }
  return {
    advertising: 96000, business_subscription: 30000, sponsored_placement: 20000,
    seller_commission: 15000, sourcing_margin: 10000, breakage: 15000,
    bnpl_merchant_fee: 5000, processing_rebate: 3000, shipping_margin: 2000,
    affiliate_commission: 2000, lead_fee: 2000,
  };
}

// ── Line classification: which lines you SELL vs which the platform MINTS from member activity ────────────
// Sales-driven = a business you actively sign/upsell/renew (the ~$150k you chase).
// Activity-driven = minted by user engagement / transaction volume with no sales headcount (the ~$50k floor).
const SALES_DRIVEN = new Set<RevenueType>([
  "advertising", "grid_fee", "sponsored_placement", "business_subscription",
  "business_signup", "business_onboarding", "audience_panel", "white_label", "sponsored_prize",
]);
const ACTIVITY_DRIVEN = new Set<RevenueType>([
  "seller_commission", "sourcing_margin", "affiliate_commission", "lead_fee", "coop_fund",
  "processing_rebate", "breakage", "dev_creator_cut", "bnpl_merchant_fee", "membership_fee",
  "arbitrage_margin", "shipping_margin", "curator_reward", "referral_bonus", "referral_override",
  "screenout_credit", "buddy_bonus", "earnback_subsidy", "other",
]);
export function lineCategory(type: string): "sales_driven" | "activity_driven" {
  return SALES_DRIVEN.has(type as RevenueType) ? "sales_driven" : ACTIVITY_DRIVEN.has(type as RevenueType) ? "activity_driven" : "activity_driven";
}

// ── Annualize + project ─────────────────────────────────────────────────────────────────────────────────
/** Turn a windowed actual into an annual run-rate. */
export function annualizeUsd(amountUsd: number, windowDays: number): number {
  const days = Math.max(1, Number(windowDays) || 1);
  return r2((Math.max(0, Number(amountUsd) || 0) / days) * 365);
}
/** Flat-run-rate multi-year projection: [{year, annual_usd, cumulative_usd}, ...] + total. */
export function projectYears(annualUsd: number, years: number): { schedule: Array<{ year: number; annual_usd: number; cumulative_usd: number }>; cumulative_usd: number } {
  const a = Math.max(0, Number(annualUsd) || 0);
  const n = clampYears(years);
  const schedule = [];
  let cum = 0;
  for (let y = 1; y <= n; y++) { cum += a; schedule.push({ year: y, annual_usd: r2(a), cumulative_usd: r2(cum) }); }
  return { schedule, cumulative_usd: r2(cum) };
}

// ── Ledger row shape (only the fields we read) ──────────────────────────────────────────────────────────
export interface LedgerRow { kind?: string; type?: string; amount_usd?: number; business_id?: string | null; user_id?: string | null; at?: string; created_date?: string; customer_paid?: boolean; }

function rowTime(r: LedgerRow): number {
  const t = r.at ? Date.parse(String(r.at)) : (r.created_date ? Date.parse(String(r.created_date)) : 0);
  return Number.isFinite(t) ? t : 0;
}

// ── Build the stack ─────────────────────────────────────────────────────────────────────────────────────
export interface StackLine {
  type: string; category: "sales_driven" | "activity_driven";
  actual_window_usd: number; actual_annualized_usd: number; target_annual_usd: number; pct_of_target: number;
}
export interface RevenueStack {
  window_days: number; annual_target_usd: number; horizon_years: number;
  lines: StackLine[];
  actual_annualized_usd: number; pct_to_target: number; gap_to_target_usd: number;
  sales_driven_annualized_usd: number; activity_driven_annualized_usd: number; activity_floor_pct: number;
  five_year: { schedule: Array<{ year: number; annual_usd: number; cumulative_usd: number }>; cumulative_usd: number; target_cumulative_usd: number };
  customer_paid_usd: number; invariant_ok: boolean;
}

/** Aggregate revenue rows (kind:"revenue") over a window into the blended stack vs the $200k target.
 *  Optionally inject an out-of-band breakage annual estimate (a stock, not a ledger flow) into the "breakage"
 *  line so the stack reflects it. Subsidies (kind:"subsidy") are ignored — they're costs, not revenue. */
export function buildRevenueStack(rows: LedgerRow[], windowDays: number, opts?: { breakageAnnualUsd?: number }): RevenueStack {
  const days = Math.max(1, Number(windowDays) || 1);
  const cutoff = Date.now() - days * 86400000;
  const blend = stackTargetBlend();
  const target = revenueStackAnnualTargetUsd();
  const horizon = revenueStackHorizonYears();

  const byType: Record<string, number> = {};
  let customerPaid = 0;
  for (const r of rows || []) {
    if (r.kind === "subsidy") continue;                 // costs, not revenue
    const t = rowTime(r);
    if (t && t < cutoff) continue;
    const amt = Math.max(0, Number(r.amount_usd) || 0);
    const type = String(r.type || "other");
    byType[type] = r2((byType[type] || 0) + amt);
    if (r.customer_paid === true) customerPaid += amt;  // invariant: must stay 0
  }

  // Every type that appears in EITHER actuals or the target blend gets a line.
  const types = new Set<string>([...Object.keys(byType), ...Object.keys(blend)]);
  const lines: StackLine[] = [];
  let annualTotal = 0, salesTotal = 0, activityTotal = 0;
  for (const type of types) {
    let annualized = annualizeUsd(byType[type] || 0, days);
    let windowActual = byType[type] || 0;
    if (type === "breakage" && opts?.breakageAnnualUsd && opts.breakageAnnualUsd > 0) {
      // breakage is estimated from outstanding points (a stock); treat the estimate as the annual figure.
      annualized = r2(opts.breakageAnnualUsd);
      windowActual = r2(opts.breakageAnnualUsd * (days / 365));
    }
    const tgt = r2(blend[type] || 0);
    const cat = lineCategory(type);
    lines.push({
      type, category: cat,
      actual_window_usd: r2(windowActual), actual_annualized_usd: annualized,
      target_annual_usd: tgt, pct_of_target: tgt > 0 ? r2((annualized / tgt) * 100) : 0,
    });
    annualTotal += annualized;
    if (cat === "sales_driven") salesTotal += annualized; else activityTotal += annualized;
  }
  lines.sort((a, b) => b.target_annual_usd - a.target_annual_usd || b.actual_annualized_usd - a.actual_annualized_usd);

  annualTotal = r2(annualTotal);
  const proj = projectYears(annualTotal, horizon);
  return {
    window_days: days, annual_target_usd: target, horizon_years: horizon,
    lines,
    actual_annualized_usd: annualTotal,
    pct_to_target: target > 0 ? r2((annualTotal / target) * 100) : 0,
    gap_to_target_usd: r2(Math.max(0, target - annualTotal)),
    sales_driven_annualized_usd: r2(salesTotal),
    activity_driven_annualized_usd: r2(activityTotal),
    activity_floor_pct: annualTotal > 0 ? r2((activityTotal / annualTotal) * 100) : 0,
    five_year: { ...proj, target_cumulative_usd: r2(target * horizon) },
    customer_paid_usd: r2(customerPaid), invariant_ok: customerPaid === 0,
  };
}

// ── Per-customer 5-year value ───────────────────────────────────────────────────────────────────────────
export interface CustomerValue {
  business_id: string; window_days: number; horizon_years: number;
  by_type: Record<string, number>;
  actual_window_usd: number; annualized_usd: number;
  five_year: { schedule: Array<{ year: number; annual_usd: number; cumulative_usd: number }>; cumulative_usd: number };
}

/** One business customer's value: trailing actual → annualized run-rate → projected over the 5-year horizon. */
export function customerFiveYearValue(rows: LedgerRow[], businessId: string, windowDays: number): CustomerValue {
  const days = Math.max(1, Number(windowDays) || 1);
  const cutoff = Date.now() - days * 86400000;
  const horizon = customerValueHorizonYears();
  const byType: Record<string, number> = {};
  let windowTotal = 0;
  for (const r of rows || []) {
    if (r.kind === "subsidy") continue;
    if (String(r.business_id || "") !== String(businessId)) continue;
    const t = rowTime(r);
    if (t && t < cutoff) continue;
    const amt = Math.max(0, Number(r.amount_usd) || 0);
    byType[String(r.type || "other")] = r2((byType[String(r.type || "other")] || 0) + amt);
    windowTotal += amt;
  }
  const annualized = annualizeUsd(windowTotal, days);
  return {
    business_id: String(businessId), window_days: days, horizon_years: horizon,
    by_type: byType, actual_window_usd: r2(windowTotal), annualized_usd: annualized,
    five_year: projectYears(annualized, horizon),
  };
}

/** Rank business customers by projected value over the horizon (top N). */
export function topCustomersByValue(rows: LedgerRow[], windowDays: number, n = 10): CustomerValue[] {
  const ids = new Set<string>();
  for (const r of rows || []) { if (r.kind !== "subsidy" && r.business_id) ids.add(String(r.business_id)); }
  const vals = [...ids].map((id) => customerFiveYearValue(rows, id, windowDays));
  vals.sort((a, b) => b.five_year.cumulative_usd - a.five_year.cumulative_usd);
  return vals.slice(0, Math.max(1, Math.min(200, Math.round(n))));
}
