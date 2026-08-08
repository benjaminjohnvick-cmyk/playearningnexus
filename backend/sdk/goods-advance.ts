// Goods Advance — optional, opt-in, CLOSED-LOOP, 0%, NON-RECOURSE in-store advance.
//
// This is a consumer-credit product and is treated as one. It is DISABLED BY DEFAULT and
// PROVIDER-GATED: origination is impossible until (1) the `goods_advance` flag is ON, (2) a
// licensed lender of record is configured (ADVANCE_PROVIDER != "none"), and (3) counsel has
// signed off (ADVANCE_LEGAL_SIGNOFF = true). See GET-GOODS-ADVANCE-PROGRAM-COMPLIANCE.md.
//
// Deliberately NOT implemented (illegal/coercive): lockout / mandatory-daily-use loan terms
// (peonage), auto-charging a backup card on default (card-network + UDAAP), forcing purchases
// through the advance, cash balloons, and consumer collections. Repayment is non-recourse: if a
// member doesn't earn it back, the balance is written off — no cash is ever demanded.
import { isEnabled } from "./feature-flags.ts";
import { getNumber, getBool, getString } from "./settings.ts";
import { db } from "./db.ts";

export interface AdvanceConfig {
  enabled: boolean;          // flag goods_advance
  provider: string;          // "none" | "bank_sponsored" | "licensed_self"
  legalSignoff: boolean;     // ADVANCE_LEGAL_SIGNOFF
  live: boolean;             // all three of the above true
  capUsd: number;            // ADVANCE_MAX_CAP_USD (default 2920)
  aprPct: number;            // ADVANCE_APR_PCT (must be 0 in this build)
  termMonths: number;        // ADVANCE_TERM_MONTHS (default 12)
  minHistoryDays: number;    // ADVANCE_MIN_HISTORY_DAYS
  nonRecourse: boolean;      // ADVANCE_NONRECOURSE (must be true in this build)
  requireAtr: boolean;       // ADVANCE_REQUIRE_ABILITY_TO_REPAY
}

export async function advanceConfig(jurisdiction?: string | null): Promise<AdvanceConfig> {
  const enabled = await isEnabled("goods_advance", jurisdiction ?? null);
  const provider = await getString("ADVANCE_PROVIDER", "none");
  const legalSignoff = await getBool("ADVANCE_LEGAL_SIGNOFF", false);
  return {
    enabled,
    provider,
    legalSignoff,
    live: enabled && provider !== "none" && legalSignoff === true,
    capUsd: await getNumber("ADVANCE_MAX_CAP_USD", 2920),
    aprPct: await getNumber("ADVANCE_APR_PCT", 0),
    termMonths: await getNumber("ADVANCE_TERM_MONTHS", 12),
    minHistoryDays: await getNumber("ADVANCE_MIN_HISTORY_DAYS", 60),
    nonRecourse: await getBool("ADVANCE_NONRECOURSE", true),
    requireAtr: await getBool("ADVANCE_REQUIRE_ABILITY_TO_REPAY", true),
  };
}

// The hard gate. Origination code paths MUST await this and refuse when it is false.
export async function advanceProgramLive(jurisdiction?: string | null): Promise<boolean> {
  return (await advanceConfig(jurisdiction)).live;
}

// Trailing earning history for ability-to-repay. Reads the member's own earnings ledger.
// Returns activeDays (distinct days with earnings in the window) and avgDailyUsd (over active days).
export interface EarnHistory { activeDays: number; avgDailyUsd: number; windowDays: number; totalUsd: number; }

export async function earnHistory(userId: string, windowDays = 90): Promise<EarnHistory> {
  // Transactions are owner-scoped; we only read the caller's own rows. Amount is in USD-equivalent.
  const since = Date.now() - windowDays * 86400_000;
  let rows: Array<Record<string, unknown>> = [];
  try {
    rows = await db.filter("Transaction", { user_id: userId, type: "earning" }, "-created_date", 2000);
  } catch { rows = []; }
  const byDay = new Set<string>();
  let total = 0;
  for (const r of rows) {
    const ts = Date.parse(String((r as Record<string, unknown>).created_date ?? "")); // ISO
    if (!Number.isFinite(ts) || ts < since) continue;
    const amt = Number((r as Record<string, unknown>).amount_usd ?? (r as Record<string, unknown>).amount ?? 0);
    if (Number.isFinite(amt) && amt > 0) {
      total += amt;
      byDay.add(new Date(ts).toISOString().slice(0, 10));
    }
  }
  const activeDays = byDay.size;
  return { activeDays, avgDailyUsd: activeDays ? total / activeDays : 0, windowDays, totalUsd: total };
}

export interface Eligibility {
  available: boolean;         // program live AND member qualifies
  programLive: boolean;       // gate state (independent of the member)
  reason: string;             // why not, if not available
  cap: number;                // program cap
  maxOfferUsd: number;        // per-member limit from ability-to-repay (0 if not eligible)
  aprPct: number;
  termMonths: number;
  nonRecourse: boolean;
  history: EarnHistory;
  disclosures: string[];      // required TILA-style disclosure lines to show + get consent on
}

// Per-member offer = min(program cap, what a year of the member's demonstrated earn rate can repay).
// Underwrites on the PAST; never compels future activity. Conservative (uses trailing avg).
export async function assessEligibility(user: { id: string; date_of_birth?: string } | Record<string, unknown>, jurisdiction?: string | null): Promise<Eligibility> {
  const cfg = await advanceConfig(jurisdiction);
  const uid = String((user as Record<string, unknown>).id);
  const hist = await earnHistory(uid);
  const base: Omit<Eligibility, "available" | "reason" | "maxOfferUsd"> = {
    programLive: cfg.live,
    cap: cfg.capUsd,
    aprPct: cfg.aprPct,
    termMonths: cfg.termMonths,
    nonRecourse: cfg.nonRecourse,
    history: hist,
    disclosures: disclosureLines(cfg),
  };
  if (!cfg.live) {
    return { ...base, available: false, reason: "Advance program is not available yet (pending provider + legal sign-off).", maxOfferUsd: 0 };
  }
  if (cfg.requireAtr) {
    if (hist.activeDays < cfg.minHistoryDays) {
      return { ...base, available: false, reason: `Not enough earning history yet (need ${cfg.minHistoryDays} active days; you have ${hist.activeDays}).`, maxOfferUsd: 0 };
    }
    if (hist.avgDailyUsd <= 0) {
      return { ...base, available: false, reason: "No recent earnings to base an offer on.", maxOfferUsd: 0 };
    }
  }
  // What the member could plausibly repay over the term at their trailing rate (conservative).
  const repayCapacity = hist.avgDailyUsd * 30 * cfg.termMonths;
  const maxOffer = Math.max(0, Math.min(cfg.capUsd, Math.floor(repayCapacity)));
  return {
    ...base,
    available: maxOffer > 0,
    reason: maxOffer > 0 ? "" : "Your current earning rate doesn't support an advance yet.",
    maxOfferUsd: maxOffer,
  };
}

export function disclosureLines(cfg: AdvanceConfig): string[] {
  return [
    `This is an optional advance of up to $${cfg.capUsd.toLocaleString()} to spend in the store.`,
    `${cfg.aprPct === 0 ? "0% APR — no interest, no fees, no markup." : `APR: ${cfg.aprPct}%.`}`,
    `You repay it from your own future in-app earnings over up to ${cfg.termMonths} months.`,
    cfg.nonRecourse
      ? "If you don't earn enough to repay, you owe nothing in cash — the balance is written off. We will not charge a card or send you to collections."
      : "Repayment terms apply; see full terms.",
    "It is never required to make a purchase — you can always buy with the balance you've already earned.",
    "This advance is not reported to credit bureaus.",
    "Using it is your choice; you can decline with no effect on your account.",
  ];
}

// Repayment projection for the tracker. Informational only — encouragement, never penalties.
export interface Projection {
  principal: number; repaid: number; remaining: number;
  avgDailyUsd: number; projectedDaysToPayoff: number | null;
  onTrackForTerm: boolean; termMonths: number;
  message: string;
}

export function project(principal: number, repaid: number, avgDailyUsd: number, termMonths: number): Projection {
  const remaining = Math.max(0, principal - repaid);
  const days = avgDailyUsd > 0 ? Math.ceil(remaining / avgDailyUsd) : null;
  const onTrack = days !== null && days <= termMonths * 30;
  let message: string;
  if (remaining <= 0) message = "Paid off — nice work!";
  else if (days === null) message = "Earn a little to start paying this down. No pressure — nothing is owed in cash.";
  else if (onTrack) message = `On pace to clear this in about ${days} days at your recent rate.`;
  else message = `At your recent pace this would take about ${days} days. Earning a bit more speeds it up — but remember, if you don't, you owe nothing in cash.`;
  return { principal, repaid, remaining, avgDailyUsd, projectedDaysToPayoff: days, onTrackForTerm: onTrack, termMonths, message };
}
