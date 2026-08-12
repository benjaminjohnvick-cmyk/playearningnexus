// tier1-financed.ts — Tier 1 "pay-from-earnings" FINANCED advertising package.
//
// WHAT THIS IS (and why it is gated hard): the advertiser takes the Tier 1 package with $0 upfront and OWES
// $12,000. The site automatically sweeps their in-app earnings toward that balance over a 12-month term; at
// term end any REMAINING balance is DUE and payable. Because the $12,000 is owed regardless of how much the
// advertiser earns, this is RECOURSE consumer/commercial CREDIT — a real debt, not a share of revenue. That
// makes it heavier than the non-recourse Goods Advance and MORE regulated.
//
// It is therefore DISABLED BY DEFAULT and PROVIDER + COUNSEL GATED. Origination is impossible until:
//   (1) the `tier1_financed` flag is ON,
//   (2) a licensed creditor of record is configured (TIER1_FINANCED_PROVIDER != "none"), and
//   (3) counsel has signed off (TIER1_FINANCED_LEGAL_SIGNOFF = true).
// This scaffold NEVER moves money by itself. It has NO lockout, NO backup-card charge, and NO collections
// logic wired — any actual billing/servicing/collection at term end must be performed by the licensed
// provider under counsel-approved terms. See TIER1-FINANCED-PAY-FROM-EARNINGS.md.
import { isEnabled } from "./feature-flags.ts";
import { getNumber, getBool, getString } from "./settings.ts";
import { db } from "./db.ts";
import { earnHistory, type EarnHistory } from "./goods-advance.ts";

export interface Tier1FinancedConfig {
  enabled: boolean;          // flag tier1_financed
  provider: string;          // "none" | "bank_sponsored" | "licensed_self"
  legalSignoff: boolean;     // TIER1_FINANCED_LEGAL_SIGNOFF
  live: boolean;             // all three gate conditions true
  principalUsd: number;      // TIER1_FINANCED_PRINCIPAL_USD (12000)
  aprPct: number;            // TIER1_FINANCED_APR_PCT (0 in this build)
  termMonths: number;        // TIER1_FINANCED_TERM_MONTHS (12)
  sweepPct: number;          // TIER1_FINANCED_EARNINGS_SWEEP_PCT (1 = 100% of earnings)
  minHistoryDays: number;    // TIER1_FINANCED_MIN_HISTORY_DAYS
  recourse: boolean;         // TIER1_FINANCED_RECOURSE (true — the debt is owed)
  requireAtr: boolean;       // TIER1_FINANCED_REQUIRE_ABILITY_TO_REPAY
}

export async function tier1FinancedConfig(jurisdiction?: string | null): Promise<Tier1FinancedConfig> {
  const enabled = await isEnabled("tier1_financed", jurisdiction ?? null);
  const provider = await getString("TIER1_FINANCED_PROVIDER", "none");
  const legalSignoff = await getBool("TIER1_FINANCED_LEGAL_SIGNOFF", false);
  return {
    enabled,
    provider,
    legalSignoff,
    live: enabled && provider !== "none" && legalSignoff === true,
    principalUsd: await getNumber("TIER1_FINANCED_PRINCIPAL_USD", 12000),
    aprPct: await getNumber("TIER1_FINANCED_APR_PCT", 0),
    termMonths: await getNumber("TIER1_FINANCED_TERM_MONTHS", 12),
    sweepPct: Math.min(1, Math.max(0, await getNumber("TIER1_FINANCED_EARNINGS_SWEEP_PCT", 1))),
    minHistoryDays: await getNumber("TIER1_FINANCED_MIN_HISTORY_DAYS", 60),
    recourse: await getBool("TIER1_FINANCED_RECOURSE", true),
    requireAtr: await getBool("TIER1_FINANCED_REQUIRE_ABILITY_TO_REPAY", true),
  };
}

// The hard gate. Origination code paths MUST await this and refuse when it is false.
export async function tier1FinancedLive(jurisdiction?: string | null): Promise<boolean> {
  return (await tier1FinancedConfig(jurisdiction)).live;
}

export interface Tier1Eligibility {
  available: boolean;        // program live AND advertiser qualifies
  programLive: boolean;      // gate state (independent of the advertiser)
  reason: string;
  principalUsd: number;      // the amount that would be owed ($12,000)
  aprPct: number;
  termMonths: number;
  recourse: boolean;
  sweepPct: number;
  history: EarnHistory;
  projectedSweepUsd: number; // what a year of the advertiser's trailing earn rate would sweep (estimate)
  projectedShortfallUsd: number; // principal − projectedSweep (what they'd likely still OWE at term end)
  disclosures: string[];
}

// Underwrites on the PAST (trailing earn rate). Because this is RECOURSE, ability-to-repay is not optional:
// we require enough demonstrated earning that a year of sweeps could plausibly clear the $12,000 — otherwise
// the advertiser is being set up to owe a cash shortfall, which is exactly what we must not do casually.
export async function assessTier1Eligibility(user: { id: string } | Record<string, unknown>, jurisdiction?: string | null): Promise<Tier1Eligibility> {
  const cfg = await tier1FinancedConfig(jurisdiction);
  const uid = String((user as Record<string, unknown>).id);
  const hist = await earnHistory(uid);
  const projectedSweep = Math.max(0, hist.avgDailyUsd * cfg.sweepPct * 30 * cfg.termMonths);
  const projectedShortfall = Math.max(0, cfg.principalUsd - projectedSweep);
  const base: Omit<Tier1Eligibility, "available" | "reason"> = {
    programLive: cfg.live,
    principalUsd: cfg.principalUsd,
    aprPct: cfg.aprPct,
    termMonths: cfg.termMonths,
    recourse: cfg.recourse,
    sweepPct: cfg.sweepPct,
    history: hist,
    projectedSweepUsd: Math.round(projectedSweep * 100) / 100,
    projectedShortfallUsd: Math.round(projectedShortfall * 100) / 100,
    disclosures: tier1DisclosureLines(cfg),
  };
  if (!cfg.live) {
    return { ...base, available: false, reason: "Tier 1 financing is not available yet (pending licensed provider + counsel sign-off)." };
  }
  if (cfg.requireAtr) {
    if (hist.activeDays < cfg.minHistoryDays) {
      return { ...base, available: false, reason: `Not enough earning history yet (need ${cfg.minHistoryDays} active days; you have ${hist.activeDays}).` };
    }
    // Only offer if a year of sweeps could plausibly clear the debt — don't set an advertiser up to owe cash.
    if (projectedSweep < cfg.principalUsd) {
      return { ...base, available: false, reason: `Your recent earning rate would not clear $${cfg.principalUsd.toLocaleString()} within ${cfg.termMonths} months, which would leave a cash balance owed. Pay upfront instead, or use the non-recourse earn-to-unlock tier.` };
    }
  }
  return { ...base, available: true, reason: "" };
}

// HONEST recourse disclosures. Nothing here softens the fact that $12,000 is OWED.
export function tier1DisclosureLines(cfg: Tier1FinancedConfig): string[] {
  return [
    `This finances the Tier 1 advertising package: you OWE $${cfg.principalUsd.toLocaleString()}. It is a debt, not a fee waiver and not a share of revenue.`,
    `${cfg.aprPct === 0 ? "0% APR — no interest or finance charge on the balance." : `APR: ${cfg.aprPct}%.`}`,
    `You authorize the site to automatically apply ${Math.round(cfg.sweepPct * 100)}% of your in-app earnings to the balance over a ${cfg.termMonths}-month term.`,
    cfg.recourse
      ? `RECOURSE: at the end of the term, any REMAINING balance is DUE and payable. If your earnings do not cover the $${cfg.principalUsd.toLocaleString()}, you still owe the difference.`
      : "Non-recourse: only your earnings are applied; no shortfall is owed.",
    "Missing payment at term end may have consequences set by the creditor of record under its terms and applicable law.",
    "You can instead pay the package upfront, or use the free non-recourse earn-to-unlock tier where nothing is ever owed.",
    "Servicing, billing, and any collection at term end are handled by the licensed creditor of record — not automatically by the app.",
  ];
}

export interface Tier1Plan {
  principal_usd: number; swept_usd: number; remaining_usd: number;
  term_months: number; recourse: boolean; sweepPct: number;
  projectedSweepUsd: number; projectedShortfallUsd: number;
  message: string;
}

// Tracker projection (informational). Applies the sweep to earnings-so-far and projects the term-end balance.
export function projectTier1(principal: number, sweptSoFar: number, avgDailyUsd: number, cfg: { termMonths: number; sweepPct: number; recourse: boolean }): Tier1Plan {
  const remaining = Math.max(0, principal - sweptSoFar);
  const projectedSweepRemainder = Math.max(0, avgDailyUsd * cfg.sweepPct * 30 * cfg.termMonths);
  const projectedShortfall = Math.max(0, remaining - projectedSweepRemainder);
  let message: string;
  if (remaining <= 0) message = "Balance cleared from earnings — paid in full.";
  else if (!cfg.recourse) message = `About $${Math.round(remaining).toLocaleString()} left; only earnings are applied and nothing is owed beyond them.`;
  else if (projectedShortfall <= 0) message = `On pace to clear the balance from earnings before the term ends.`;
  else message = `About $${Math.round(remaining).toLocaleString()} left. At your recent earn rate roughly $${Math.round(projectedShortfall).toLocaleString()} could remain OWED as cash at term end — earning more reduces it.`;
  return {
    principal_usd: principal, swept_usd: sweptSoFar, remaining_usd: remaining,
    term_months: cfg.termMonths, recourse: cfg.recourse, sweepPct: cfg.sweepPct,
    projectedSweepUsd: Math.round(projectedSweepRemainder * 100) / 100,
    projectedShortfallUsd: Math.round(projectedShortfall * 100) / 100,
    message,
  };
}

// Read the caller's active financed plan (owner-scoped), if any.
export async function activeTier1Plan(userId: string): Promise<Record<string, unknown> | null> {
  try {
    const rows = await db.filter("Tier1FinancedPlan", { user_id: userId, status: "active" }, "-created_date", 1);
    return (rows && rows[0]) || null;
  } catch { return null; }
}
