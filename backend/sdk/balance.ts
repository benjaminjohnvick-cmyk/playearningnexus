// Atomic balance adjustment helper.
//
// Every money field on User (current_balance, refund_credit_balance, total_earnings, points, …) must
// be moved with a compare-and-set so two concurrent runs can't both read the same balance and double
// spend / double credit. This wraps db.updateIf (WHERE data->>'field' = <old>) in a bounded retry so
// a call site becomes a one-liner instead of an open-coded loop.
//
// Returns the new value on success, or null if the change couldn't be committed (contention exhausted
// or, for a debit, insufficient funds). Callers should treat null as "not applied".
import { db } from "./db.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

export interface AdjustOpts {
  field?: string;        // which numeric field to move (default current_balance)
  floorZero?: boolean;   // clamp the result at 0 instead of failing when a debit would go negative
  allowNegative?: boolean; // permit the result to go below 0 (default false)
  round?: boolean;       // round the result to cents (default true)
  tries?: number;        // max compare-and-set attempts (default 6)
}

/** Atomically add `delta` (may be negative) to a User's money field. Re-reads the current value each
 *  attempt and only commits if it hasn't changed, so concurrent adjustments serialize instead of
 *  racing. On a debit that would overdraw: floorZero clamps to 0, otherwise the call fails (null). */
export async function adjustUserBalance(userId: string, delta: number, opts: AdjustOpts = {}): Promise<number | null> {
  if (!userId) return null;
  const field = opts.field ?? "current_balance";
  const roundIt = opts.round !== false;
  const tries = opts.tries ?? 6;
  const d = Number(delta) || 0;

  for (let i = 0; i < tries; i++) {
    const u = await db.get("User", userId).catch(() => null);
    if (!u) return null;
    const cur = Number((u as Record<string, unknown>)[field]) || 0;
    let next = cur + d;
    if (next < 0) {
      if (opts.floorZero) next = 0;
      else if (!opts.allowNegative) return null; // insufficient funds
    }
    if (roundIt) next = round2(next);
    const ok = await db.updateIf("User", userId, { [field]: next }, { field, equals: String(cur) }).catch(() => null);
    if (ok) return next;
  }
  return null; // contention — caller should skip/retry
}
