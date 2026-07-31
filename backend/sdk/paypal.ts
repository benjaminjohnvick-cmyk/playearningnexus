// paypal.ts — money ROUTING + accounting through the owner's PayPal business account.
//
// IMPORTANT BOUNDARY: this module does the ACCOUNTING and computes what to charge/fund — it does NOT move
// real money. Live transfers require the owner's PayPal API credentials and run under their account; nothing
// here initiates a payout on its own. Every in/out is written to the immutable MoneyLedgerEntry so the
// profit view is exact, and the actual capture/payout is executed by the PayPal integration the owner wires.

import { db } from "./db.ts";
import { snapString } from "./settings.ts";

export const paymentsProvider = () => snapString("PAYMENTS_PROVIDER", "paypal").toLowerCase() || "paypal";
export const paypalBusinessEmail = () => snapString("PAYPAL_BUSINESS_EMAIL", "");
export const paypalMerchantId = () => snapString("PAYPAL_MERCHANT_ID", "");

const r2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Net a customer actually owes after the platform-funded reward + loyalty discount is applied. */
export function netChargeAfterDiscount(faceUsd: number, discountUsd: number): number {
  return r2(Math.max(0, (Number(faceUsd) || 0) - Math.max(0, Number(discountUsd) || 0)));
}

/** Record one money flow (audit only; does not execute a transfer). direction "in" = money to the platform,
 *  "out" = money the platform funds (e.g. a customer discount paid from the PayPal business account). */
export async function recordMoneyFlow(input: {
  direction: "in" | "out"; amount_usd: number; kind: string; ref?: string | null; provider?: string; meta?: Record<string, unknown>;
}): Promise<string | null> {
  const amount = r2(Math.max(0, input.amount_usd));
  if (amount <= 0) return null;
  try {
    const row = await db.create("MoneyLedgerEntry", {
      direction: input.direction,
      amount_usd: amount,
      kind: input.kind,
      ref: input.ref ?? null,
      provider: input.provider || paymentsProvider(),
      meta: input.meta ?? {},
      at: new Date().toISOString(),
    });
    return (row as Record<string, unknown>)?.id as string ?? null;
  } catch { return null; }
}

/**
 * Apply the platform-funded discount to an order and record the two flows: the customer's NET payment comes
 * IN, and the discount the platform covers goes OUT (funded by the PayPal business account). Returns the net
 * the customer owes. Execution of the actual charge/payout is the PayPal integration's job.
 */
export async function applyOrderDiscountAndRecord(input: {
  faceUsd: number; discountUsd: number; orderRef?: string | null; userId?: string | null;
}): Promise<{ net_usd: number; discount_usd: number; face_usd: number }> {
  const face = r2(input.faceUsd);
  const discount = r2(Math.min(face, Math.max(0, input.discountUsd)));
  const net = netChargeAfterDiscount(face, discount);
  if (net > 0) await recordMoneyFlow({ direction: "in", amount_usd: net, kind: "order_payment", ref: input.orderRef, meta: { user_id: input.userId ?? null, face_usd: face, discount_usd: discount } }).catch(() => null);
  if (discount > 0) await recordMoneyFlow({ direction: "out", amount_usd: discount, kind: "reward_loyalty_discount", ref: input.orderRef, meta: { user_id: input.userId ?? null, funded_by: "paypal_business_account" } }).catch(() => null);
  return { net_usd: net, discount_usd: discount, face_usd: face };
}
