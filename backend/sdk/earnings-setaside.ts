// earnings-setaside.ts — user-controlled "set aside part of my earnings" allocation.
//
// WHAT THIS IS: a voluntary way for a user to earmark a share of their OWN earnings (closed-loop,
// non-cashable Site Cash) into a separate "set aside" bucket they can spend later — on their ad plan or
// anything else on the platform. The USER picks the percentage (0 = off, and it is off by default). It is
// their own store credit the whole time: they can change the percentage, move money into the bucket now, or
// release it back to spendable, at any moment. NOTHING is ever owed, nothing is locked, and no third party
// is involved — this is a savings/allocation convenience within the closed loop, not credit, not an
// automatic debt sweep, and it never makes the credit cashable. That keeps it clear of both lending law and
// money-transmission concerns.
import { isEnabled } from "./feature-flags.ts";
import { getNumber } from "./settings.ts";
import { db } from "./db.ts";
import { adjustUserBalance } from "./balance.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

// Field names on User: current_balance = spendable Site Cash; setaside_balance_usd = the set-aside bucket;
// earnings_setaside_pct = the user's chosen fraction (0..1) of new earnings to divert into the bucket.
export const SPENDABLE_FIELD = "current_balance";
export const SETASIDE_FIELD = "setaside_balance_usd";
export const PCT_FIELD = "earnings_setaside_pct";

export interface SetAsideConfig { enabled: boolean; maxPct: number; }

export async function earningsSetAsideConfig(jurisdiction?: string | null): Promise<SetAsideConfig> {
  return {
    enabled: await isEnabled("earnings_setaside", jurisdiction ?? null),
    maxPct: Math.min(1, Math.max(0, await getNumber("EARNINGS_SETASIDE_MAX_PCT", 1))),
  };
}

export function clampPct(pct: number, maxPct = 1): number {
  let p = Number(pct);
  if (!Number.isFinite(p) || p < 0) p = 0;
  if (p > 1) p = p / 100;             // accept 0..100 as a convenience
  return Math.min(maxPct, Math.max(0, Math.round(p * 10000) / 10000));
}

export interface SetAsideStatus {
  enabled: boolean;
  pct: number;                 // 0..1 — the user's chosen share of earnings to set aside (0 = off)
  setaside_balance_usd: number;// their own Site Cash currently set aside
  spendable_usd: number;       // their normal spendable Site Cash
  amount_owed_usd: number;     // ALWAYS 0 — this is their own money, nothing is owed
}

export function setAsideStatus(user: Record<string, unknown> | null, cfg: SetAsideConfig): SetAsideStatus {
  return {
    enabled: cfg.enabled,
    pct: clampPct(Number(user?.[PCT_FIELD]) || 0, cfg.maxPct),
    setaside_balance_usd: round2(Number(user?.[SETASIDE_FIELD]) || 0),
    spendable_usd: round2(Number(user?.[SPENDABLE_FIELD]) || 0),
    amount_owed_usd: 0,
  };
}

// Integration helper: call this right AFTER crediting a user's earnings (surveys, etc.), passing the amount
// just credited to their spendable balance. It re-buckets the user's chosen share into the set-aside bucket.
// Safe no-op when the feature is off or the user's pct is 0. Only moves money between the user's own two
// buckets — never mints or removes value. Returns how much was set aside.
export async function applyEarningSetAside(userId: string, earningUsd: number): Promise<{ setaside_usd: number }> {
  const cfg = await earningsSetAsideConfig();
  if (!cfg.enabled) return { setaside_usd: 0 };
  const u = await db.get("User", userId).catch(() => null);
  const pct = clampPct(Number((u as Record<string, unknown>)?.[PCT_FIELD]) || 0, cfg.maxPct);
  if (pct <= 0) return { setaside_usd: 0 };
  const amount = round2((Number(earningUsd) || 0) * pct);
  if (amount <= 0) return { setaside_usd: 0 };
  // Move `amount` from spendable → set-aside. If spendable is short (rounding/timing), take what's there.
  const debited = await adjustUserBalance(userId, -amount, { field: SPENDABLE_FIELD, floorZero: true });
  if (debited === null) return { setaside_usd: 0 };
  await adjustUserBalance(userId, amount, { field: SETASIDE_FIELD });
  return { setaside_usd: amount };
}

// Plain-language explanation shown WITH the control (the label explains itself, per the design ask).
export function setAsideDisclosures(): string[] {
  return [
    "This sets aside part of what YOU earn, into your own separate bucket — it's still your Site Cash, just parked for later.",
    "You choose the percentage. 0% means off, and it's off unless you turn it on.",
    "Spend it whenever you like — toward your ad plan or anything else on the platform.",
    "Change the percentage, add to it, or move it back to spendable at any time. Nothing is owed and nothing is locked.",
    "It stays closed-loop store credit (non-cashable) the whole time — setting it aside doesn't change that.",
  ];
}
