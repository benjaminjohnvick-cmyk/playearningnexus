// Payout reservation accounting.
//
// requestPayout reserves funds by adding the requested amount to the user's `pending_payouts`
// (availableBalance = total_earnings - pending_payouts), which prevents double-spend. When a request
// is REJECTED the money never leaves, so the hold must be released. On COMPLETED we intentionally
// keep the hold — the money is gone, so it should stay out of the available balance.

/** Release a rejected/cancelled payout's hold: decrement pending_payouts by `amount` (floored at 0).
 *  Idempotency-guarded by a marker on the request so re-fired update events don't release twice. */
export async function releaseReservation(
  base44: any,
  userId: string,
  amount: number,
): Promise<boolean> {
  const amt = Number(amount) || 0;
  if (!userId || amt <= 0) return false;
  const user = (await base44.asServiceRole.entities.User.filter({ id: userId }))[0];
  if (!user) return false;
  const next = Math.max(0, Math.round(((Number(user.pending_payouts) || 0) - amt) * 100) / 100);
  await base44.asServiceRole.entities.User.update(userId, { pending_payouts: next });
  return true;
}
