// Money-movement audit log + idempotency (Master Plan 0.4).
//
// Every balance change / payout should write an immutable MoneyLedgerEntry, and every money
// operation should run through withIdempotency() so a retried job can't double-charge or double-pay.
// Clean, immutable books are what make audits, chargebacks, and processor reviews cheap.
import { db } from "./db.ts";

export interface LedgerInput {
  user_id?: string | null;
  counterparty_id?: string | null;
  type: string;              // "payout" | "store_order" | "points_earned" | "refund" | ...
  amount: number;            // signed: +credit to user, -debit
  currency?: string;         // "USD" | "POINTS"
  ref?: string | null;       // external id (Stripe/PayPal/etc.)
  idempotency_key?: string | null;
  meta?: Record<string, unknown>;
}

/** Append an immutable money-movement row (never updated or deleted). */
export async function postLedgerEntry(e: LedgerInput) {
  return await db.create("MoneyLedgerEntry", {
    user_id: e.user_id ?? null,
    counterparty_id: e.counterparty_id ?? null,
    type: e.type,
    amount: Number(e.amount) || 0,
    currency: e.currency ?? "USD",
    ref: e.ref ?? null,
    idempotency_key: e.idempotency_key ?? null,
    meta: e.meta ?? {},
    at: new Date().toISOString(),
  }, e.user_id ?? undefined);
}

/**
 * Run `fn` at most once per key. If the key was already completed, returns the stored result instead
 * of running again. Use it around every charge/payout, e.g.:
 *   await withIdempotency(`payout:${payoutId}`, () => doPayout());
 *
 * NOTE: this guards against retries and most double-submits. For strict exactly-once under heavy
 * concurrency, add a UNIQUE index on IdempotencyKey.key at the DB level (follow-up hardening).
 */
export async function withIdempotency<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = await db.filter("IdempotencyKey", { key }, "-created_date", 1) as Record<string, unknown>[];
  if ((existing || []).length) {
    const row = existing[0];
    if (row.status === "done") return row.result as T;
    throw new Error(`Operation already in progress or previously failed for key: ${key}`);
  }
  const created = await db.create("IdempotencyKey", { key, status: "in_flight", at: new Date().toISOString() }) as Record<string, unknown>;
  try {
    const result = await fn();
    await db.update("IdempotencyKey", created.id as string, { status: "done", result, done_at: new Date().toISOString() });
    return result;
  } catch (err) {
    await db.update("IdempotencyKey", created.id as string, { status: "failed", error: (err as Error).message });
    throw err;
  }
}
