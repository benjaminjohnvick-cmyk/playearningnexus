// treasury.ts — solvency / reserve math for the business account.
//
// Answers one question: "how much cash MUST stay in the PayPal business account to cover every obligation,
// and therefore how much is safe to withdraw?" It sums the platform's real-money liabilities and subtracts
// them from available cash. Pure reads + aggregation (no money moves here); callers surface it or gate on it.
//
// Liabilities counted (each toggle-able):
//   • Outstanding Site Cash — the real cost if users redeem their non-cashable balances (all users' spendable
//     points × point value × coverage %). Coverage defaults to 100%; lower it toward your true redemption
//     rate once you have breakage data.
//   • Pending partner payouts — every unpaid PayoutRequest at GROSS (net to partner + withholding owed to IRS).
//   • Tax set-aside — money already earmarked for taxes (users' setaside balances), so it's never double-spent.
//   • Operating buffer — a flat extra cushion.
import { snapNumber, snapBool } from "./settings.ts";
import { db } from "./db.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;
const clamp01 = (n: number) => Math.max(0, Math.min(1, Number(n) || 0));
// Point value in USD (mirrors revenue.ts; inlined so treasury depends only on settings + db — no import cycle
// when the payout guard imports this module).
const pointValueUsd = (): number => Math.max(0.0001, (snapNumber("POINT_VALUE_CENTS", 1) || 1) / 100);

/** Cash currently available in the business account (owner-set, or synced from PayPal when connected). */
export function availableCashUsd(): number {
  return Math.max(0, round2(snapNumber("PAYPAL_BUSINESS_BALANCE_USD", 0)));
}

/** Real-money cost of outstanding Site Cash: Σ users' spendable balance × point value × coverage %. */
export async function outstandingSiteCashUsd(): Promise<number> {
  if (!snapBool("RESERVE_INCLUDE_SITECASH", true)) return 0;
  const points = await db.sum("User", "current_balance", {}).catch(() => 0);
  const coverage = clamp01(snapNumber("RESERVE_SITECASH_COVERAGE_PCT", 1));
  return round2(Math.max(0, points) * pointValueUsd() * coverage);
}

/** All unpaid partner payouts at GROSS (what leaves the account: net to partner + withholding to IRS). */
export async function pendingPayoutsUsd(): Promise<number> {
  if (!snapBool("RESERVE_INCLUDE_PENDING_PAYOUTS", true)) return 0;
  const gross = await db.sum("PayoutRequest", "amount", { status: { $in: ["pending", "approved", "processing", "queued"] } }).catch(() => 0);
  return round2(Math.max(0, gross));
}

/** Money already set aside for taxes (users' setaside balances) — reserve it so it can't be spent elsewhere. */
export async function taxSetAsideUsd(): Promise<number> {
  if (!snapBool("RESERVE_INCLUDE_TAX_SETASIDE", true)) return 0;
  const setaside = await db.sum("User", "setaside_balance_usd", {}).catch(() => 0);
  return round2(Math.max(0, setaside));
}

export function operatingBufferUsd(): number {
  return Math.max(0, round2(snapNumber("RESERVE_OPERATING_BUFFER_USD", 0)));
}

export interface ReserveBreakdown {
  total: number;
  components: { site_cash: number; pending_payouts: number; tax_setaside: number; operating_buffer: number };
}

/** The total cash that MUST stay in the account to cover every obligation. */
export async function requiredReserveUsd(): Promise<ReserveBreakdown> {
  const [site_cash, pending_payouts, tax_setaside] = await Promise.all([
    outstandingSiteCashUsd(), pendingPayoutsUsd(), taxSetAsideUsd(),
  ]);
  const operating_buffer = operatingBufferUsd();
  const total = round2(site_cash + pending_payouts + tax_setaside + operating_buffer);
  return { total, components: { site_cash, pending_payouts, tax_setaside, operating_buffer } };
}

export interface Solvency {
  available_usd: number;
  required_reserve_usd: number;
  safe_to_withdraw_usd: number;   // never below 0
  shortfall_usd: number;          // >0 means the account can't currently cover its obligations
  solvent: boolean;
  components: ReserveBreakdown["components"];
}

/** The full picture: available vs required, and how much is safe to withdraw. */
export async function solvency(): Promise<Solvency> {
  const available = availableCashUsd();
  const reserve = await requiredReserveUsd();
  const safe = round2(Math.max(0, available - reserve.total));
  const shortfall = round2(Math.max(0, reserve.total - available));
  return {
    available_usd: available,
    required_reserve_usd: reserve.total,
    safe_to_withdraw_usd: safe,
    shortfall_usd: shortfall,
    solvent: available >= reserve.total,
    components: reserve.components,
  };
}

/** Disbursement guard: return a hold REASON if paying `amountUsd` out now would drop the account below the
 *  required reserve (i.e. leave expenses uncovered), else null. Gated by PAYOUT_SOLVENCY_GUARD (default on)
 *  so every automated real-money payout automatically respects the reserve. Fail-safe: on any error it does
 *  NOT block (returns null) so a transient read issue can't freeze legitimate payouts — solvency is a
 *  belt-and-suspenders check on top of the existing cash-out kill-switch + sign-off, not the only guard. */
export async function solvencyHold(amountUsd: number): Promise<string | null> {
  try {
    if (!snapBool("PAYOUT_SOLVENCY_GUARD", true)) return null;
    const s = await solvency();
    const amt = Math.max(0, round2(amountUsd));
    if (amt <= s.safe_to_withdraw_usd) return null;
    return `solvency_hold: paying $${amt.toLocaleString()} now would leave less than the $${s.required_reserve_usd.toLocaleString()} reserve needed to cover outstanding obligations (safe-to-pay now: $${s.safe_to_withdraw_usd.toLocaleString()}).`;
  } catch { return null; }
}

/** Guard: may the owner withdraw `amountUsd` without dropping below the required reserve? */
export async function withdrawAllowed(amountUsd: number): Promise<{ allowed: boolean; max_allowed_usd: number; requested_usd: number; reason: string }> {
  const s = await solvency();
  const amt = Math.max(0, round2(amountUsd));
  if (amt <= s.safe_to_withdraw_usd) {
    return { allowed: true, max_allowed_usd: s.safe_to_withdraw_usd, requested_usd: amt, reason: "ok" };
  }
  return {
    allowed: false,
    max_allowed_usd: s.safe_to_withdraw_usd,
    requested_usd: amt,
    reason: `Blocked: withdrawing $${amt.toLocaleString()} would leave less than the $${s.required_reserve_usd.toLocaleString()} reserve needed to cover expenses. Most you can safely withdraw now is $${s.safe_to_withdraw_usd.toLocaleString()}.`,
  };
}
