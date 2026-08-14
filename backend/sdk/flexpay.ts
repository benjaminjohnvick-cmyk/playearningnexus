// flexpay.ts — "Flexible Payment Terms": a LAST-RESORT downsell that splits a product's price into
// installments (default 4 payments, one every 3 months, paid off by year-end). This is INSTALLMENT CREDIT,
// so it is DISABLED BY DEFAULT and provider + counsel + licensing gated, exactly like tier1-financed.
//
// Non-negotiable design choices baked in for compliance:
//   • The next-tier upsell is OPTIONAL / opt-in and is NEVER a condition of the terms (conditioning credit on
//     a future purchase is a tying / UDAAP problem).
//   • Ability-to-repay is required before any offer (this is offered to people who just declined — the exact
//     moment that check matters most).
//   • Pay-from-earnings is optional and separately authorized (closed-loop scrip against a real debt is a
//     money-transmission question for counsel).
//   • The scaffold NEVER moves money; a licensed creditor of record services/bills/collects.
import { isEnabled } from "./feature-flags.ts";
import { getBool, getNumber, getString } from "./settings.ts";

export interface FlexPayConfig {
  enabled: boolean; provider: string; legalSignoff: boolean; live: boolean;
  installments: number; intervalMonths: number; termMonths: number; aprPct: number;
  lastResortOnly: boolean; requireAtr: boolean; nextTierOptIn: boolean; recourse: boolean;
}

export async function flexPayConfig(jurisdiction?: string | null): Promise<FlexPayConfig> {
  const enabled = await isEnabled("flexpay", jurisdiction ?? null);
  const provider = await getString("FLEXPAY_PROVIDER", "none");
  const legalSignoff = await getBool("FLEXPAY_LEGAL_SIGNOFF", false);
  return {
    enabled, provider, legalSignoff,
    live: enabled && provider !== "none" && legalSignoff === true,
    installments: Math.max(1, await getNumber("FLEXPAY_INSTALLMENTS", 4)),
    intervalMonths: Math.max(1, await getNumber("FLEXPAY_INTERVAL_MONTHS", 3)),
    termMonths: Math.max(1, await getNumber("FLEXPAY_TERM_MONTHS", 12)),
    aprPct: await getNumber("FLEXPAY_APR_PCT", 0),
    lastResortOnly: await getBool("FLEXPAY_LAST_RESORT_ONLY", true),
    requireAtr: await getBool("FLEXPAY_REQUIRE_ABILITY_TO_REPAY", true),
    nextTierOptIn: await getBool("FLEXPAY_NEXT_TIER_OPTIN", false),
    recourse: await getBool("FLEXPAY_RECOURSE", true),
  };
}

export async function flexPayLive(jurisdiction?: string | null): Promise<boolean> {
  return (await flexPayConfig(jurisdiction)).live;
}

export interface Installment { n: number; due_month: number; amount_usd: number; }
export interface FlexPayPlan {
  price_usd: number; installments: number; interval_months: number; term_months: number;
  per_payment_usd: number; schedule: Installment[]; total_usd: number; apr_pct: number; recourse: boolean;
}

/** Build the installment schedule for a price. Equal payments spaced by intervalMonths; the last payment
 *  absorbs any rounding so the schedule sums exactly to the price. */
export function buildFlexPlan(priceUsd: number, cfg: FlexPayConfig): FlexPayPlan {
  const price = Math.max(0, Math.round((Number(priceUsd) || 0) * 100) / 100);
  const n = cfg.installments;
  const per = Math.floor((price / n) * 100) / 100;
  const schedule: Installment[] = [];
  let allocated = 0;
  for (let i = 0; i < n; i++) {
    const isLast = i === n - 1;
    const amount = isLast ? Math.round((price - allocated) * 100) / 100 : per;
    allocated = Math.round((allocated + amount) * 100) / 100;
    schedule.push({ n: i + 1, due_month: i * cfg.intervalMonths, amount_usd: amount });
  }
  return {
    price_usd: price, installments: n, interval_months: cfg.intervalMonths, term_months: cfg.termMonths,
    per_payment_usd: per, schedule, total_usd: price, apr_pct: cfg.aprPct, recourse: cfg.recourse,
  };
}

export interface FlexPayOffer {
  available: boolean;
  reason: string;
  plan: FlexPayPlan | null;
  next_tier_optin_available: boolean;   // optional, opt-in — never required
  disclosures: string[];
}

/** Decide whether to offer flexible terms for a product. Gated (live), last-resort, ability-to-repay. */
export function assessFlexPayOffer(cfg: FlexPayConfig, priceUsd: number, opts: { lastResort: boolean; abilityToRepay: boolean }): FlexPayOffer {
  const disclosures = flexPayDisclosures(cfg, priceUsd);
  if (!cfg.live) return { available: false, reason: "Flexible payment terms are not available yet (pending licensed provider + counsel sign-off).", plan: null, next_tier_optin_available: false, disclosures };
  if (cfg.lastResortOnly && !opts.lastResort) return { available: false, reason: "Flexible terms are offered only after the other options.", plan: null, next_tier_optin_available: false, disclosures };
  if (cfg.requireAtr && opts.abilityToRepay !== true) return { available: false, reason: "Flexible terms require confirming you can make the scheduled payments.", plan: null, next_tier_optin_available: false, disclosures };
  return {
    available: true, reason: "",
    plan: buildFlexPlan(priceUsd, cfg),
    next_tier_optin_available: cfg.nextTierOptIn,
    disclosures,
  };
}

export function flexPayDisclosures(cfg: FlexPayConfig, priceUsd: number): string[] {
  const per = Math.floor(((Number(priceUsd) || 0) / cfg.installments) * 100) / 100;
  return [
    `This is a payment plan (installment credit): ${cfg.installments} payments of about $${per.toLocaleString()}, one every ${cfg.intervalMonths} months, paid off within ${cfg.termMonths} months.`,
    `Payments are made by CREDIT CARD — ${cfg.installments} scheduled charges, one every ${cfg.intervalMonths} months. You are not paying from earnings.`,
    `${cfg.aprPct === 0 ? "0% APR — no interest or finance charge." : `APR: ${cfg.aprPct}%.`}`,
    cfg.recourse
      ? "The scheduled card payments are owed on schedule regardless of your results. Missing a payment has consequences set by the creditor under its terms and applicable law."
      : "Non-recourse: only what your results support is due.",
    "It is optional. You can decline and simply not buy, with no effect on your account.",
    cfg.nextTierOptIn
      ? "You MAY separately choose to move up to the next tier later if your results are strong — this is optional and is NOT a condition of these payment terms."
      : "These terms do not require you to buy anything else.",
    "You authorize the scheduled card charges; servicing, billing, and any collection are handled by the licensed creditor of record — not automatically by the app.",
  ];
}
