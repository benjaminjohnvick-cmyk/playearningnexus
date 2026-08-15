// tier1-selfpaced.ts — Tier 1 "Self-Paced" advertising subscription (NO DEBT, not credit).
//
// WHAT THIS IS (and why it needs no lender/counsel gate): the advertiser buys the Tier 1 package
// pay-as-you-go. Each voluntary payment buys that increment of advertising service (impressions/placement),
// and benefits accrue in proportion to what has actually been paid. The buyer chooses how much to pay and
// when; they can pause, resume, or cancel at any time. If they stop, they simply stop receiving new
// impressions — they OWE NOTHING. There is no fixed balance owed, no deferral of the full package, no
// recourse, no collections. Because nothing is ever owed that survives non-payment, this is NOT credit
// (contrast tier1-financed.ts, which is recourse credit and stays gated). It can therefore ship ON.
//
// The "$12,000 / year" is only an INFORMATIONAL target — the full annual package if the buyer chooses to
// pay it over the year. It is never a debt and is never billed automatically. This scaffold does NOT move
// money: a payment the buyer chooses to make runs through the normal checkout processor; this module only
// records what was paid and computes the service delivered for it.
import { isEnabled } from "./feature-flags.ts";
import { getNumber, getBool } from "./settings.ts";
import { db } from "./db.ts";

export interface Tier1SelfPacedConfig {
  enabled: boolean;         // flag tier1_selfpaced (default ON — not credit, no gate)
  monthlyBaseUsd: number;   // suggested monthly payment (FOUNDING_ADVERTISER_MONTHLY_PRICE_USD = 1000)
  annualTargetUsd: number;  // full-year package total (FOUNDING_ADVERTISER_PRICE_USD = 12000) — INFORMATIONAL, never owed
  annualImpressions: number;// impressions for a fully-paid year (FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR)
  termMonths: number;       // the year the target maps to (12) — informational, not an obligation
  minPaymentUsd: number;    // smallest single payment accepted
  maxPaymentUsd: number;    // largest single payment accepted (0 = no cap)
  allowPause: boolean;      // buyer may pause/resume anytime
  prorateBenefits: boolean; // deliver impressions in proportion to paid-to-date
}

export async function tier1SelfPacedConfig(jurisdiction?: string | null): Promise<Tier1SelfPacedConfig> {
  return {
    enabled: await isEnabled("tier1_selfpaced", jurisdiction ?? null),
    monthlyBaseUsd: await getNumber("FOUNDING_ADVERTISER_MONTHLY_PRICE_USD", 1000),
    annualTargetUsd: await getNumber("FOUNDING_ADVERTISER_PRICE_USD", 12000),
    annualImpressions: await getNumber("FOUNDING_INTERSTITIAL_IMPRESSIONS_PER_YEAR", 200000),
    termMonths: await getNumber("TIER1_SELFPACED_TERM_MONTHS", 12),
    minPaymentUsd: await getNumber("TIER1_SELFPACED_MIN_PAYMENT_USD", 50),
    maxPaymentUsd: await getNumber("TIER1_SELFPACED_MAX_PAYMENT_USD", 12000),
    allowPause: await getBool("TIER1_SELFPACED_ALLOW_PAUSE", true),
    prorateBenefits: await getBool("TIER1_SELFPACED_PRORATE_BENEFITS", true),
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface Tier1SelfPacedStatus {
  paid_to_date_usd: number;      // total the buyer has chosen to pay so far
  amount_owed_usd: number;       // ALWAYS 0 — nothing is ever owed
  payments_made: number;         // count of voluntary payments
  annual_target_usd: number;     // the full-year package (informational)
  to_finish_annual_usd: number;  // OPTIONAL amount left to complete the annual package this year — NOT owed
  progress_pct: number;          // paid_to_date / annual_target, capped at 100 (informational)
  impressions_delivered: number; // service accrued in proportion to what's been paid
  impressions_full_year: number; // what a fully-paid year delivers
  suggested_next_payment_usd: number; // a suggestion only (the monthly base) — never required
  status: string;                // "active" | "paused" | "canceled" | "new"
  complete: boolean;             // annual target fully paid (buyer chose to finish)
  message: string;
}

// Compute the status/benefits from a plan row. No debt anywhere: amount_owed is always 0, and
// "to_finish_annual" is explicitly optional (what's left IF they choose to complete the year).
export function selfPacedStatus(plan: Record<string, unknown> | null, cfg: Tier1SelfPacedConfig): Tier1SelfPacedStatus {
  const paid = Math.max(0, Number(plan?.paid_to_date_usd) || 0);
  const payments = Math.max(0, Number(plan?.payments_made) || 0);
  const status = String(plan?.status || (plan ? "active" : "new"));
  const target = Math.max(1, cfg.annualTargetUsd);
  const progress = Math.min(100, r2((paid / target) * 100));
  const delivered = cfg.prorateBenefits
    ? Math.round(cfg.annualImpressions * Math.min(1, paid / target))
    : (paid > 0 ? cfg.annualImpressions : 0);
  const toFinish = Math.max(0, r2(target - paid));
  const complete = paid >= target;
  let message: string;
  if (status === "canceled") message = "Canceled — you owe nothing. Restart anytime and pick up where you left off.";
  else if (status === "paused") message = "Paused — nothing is owed while paused. Resume and pay whenever you like.";
  else if (complete) message = "You've paid the full annual package. Nothing further is owed; renew month-to-month if you want to continue.";
  else if (paid <= 0) message = `Pay whatever you like, whenever you like — a suggested $${cfg.monthlyBaseUsd.toLocaleString()}/mo completes the year, but you're never obligated to any amount.`;
  else message = `You've paid $${paid.toLocaleString()} so far and received the matching share of impressions. You owe nothing — pay more whenever you want, or stop with no balance.`;
  return {
    paid_to_date_usd: r2(paid),
    amount_owed_usd: 0,
    payments_made: payments,
    annual_target_usd: cfg.annualTargetUsd,
    to_finish_annual_usd: toFinish,
    progress_pct: progress,
    impressions_delivered: delivered,
    impressions_full_year: cfg.annualImpressions,
    suggested_next_payment_usd: complete ? 0 : cfg.monthlyBaseUsd,
    status,
    complete,
    message,
  };
}

export interface SelfPacedPaymentCheck { ok: boolean; amount_usd: number; reason: string; }

// Validate a buyer-chosen payment amount. The buyer sets the amount; we only bound it to sane limits.
export function assessSelfPacedPayment(amountUsd: number, cfg: Tier1SelfPacedConfig): SelfPacedPaymentCheck {
  const amt = Number(amountUsd);
  if (!Number.isFinite(amt) || amt <= 0) return { ok: false, amount_usd: 0, reason: "Enter a payment amount greater than $0." };
  if (amt < cfg.minPaymentUsd) return { ok: false, amount_usd: amt, reason: `Minimum single payment is $${cfg.minPaymentUsd.toLocaleString()}.` };
  if (cfg.maxPaymentUsd > 0 && amt > cfg.maxPaymentUsd) return { ok: false, amount_usd: amt, reason: `Maximum single payment is $${cfg.maxPaymentUsd.toLocaleString()}.` };
  return { ok: true, amount_usd: r2(amt), reason: "" };
}

// No-credit disclosures. The point of every line: nothing is owed.
export function selfPacedDisclosures(cfg: Tier1SelfPacedConfig): string[] {
  return [
    "This is a pay-as-you-go advertising subscription — NOT a loan and NOT credit. You never owe a balance.",
    `You choose how much to pay and when. A suggested $${cfg.monthlyBaseUsd.toLocaleString()}/mo completes the $${cfg.annualTargetUsd.toLocaleString()} annual package over ${cfg.termMonths} months, but no amount is ever required.`,
    "You receive advertising service in proportion to what you've actually paid. Pay more, get more; pay less, get less.",
    cfg.allowPause ? "Pause, resume, or cancel anytime. If you stop, you simply stop getting new impressions — there is no balance, no debt, and no collections." : "Cancel anytime with no balance owed.",
    "Nothing is deferred: you are never given the full package on credit, so there is nothing to repay.",
    "Each payment you choose to make runs through the normal checkout — the app never auto-charges you and never sweeps your earnings.",
  ];
}

export async function activeSelfPacedPlan(userId: string): Promise<Record<string, unknown> | null> {
  try {
    const rows = await db.filter("Tier1SelfPacedPlan", { user_id: userId }, "-created_date", 1);
    return (rows && rows[0]) || null;
  } catch { return null; }
}
