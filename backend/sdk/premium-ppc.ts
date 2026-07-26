// Premium PPC — in-store-credit advance engine (shared config + helpers).
//
// MODEL (per matched advertiser⇄user pair):
//   • An advertiser pays PPC_GRID_ANNUAL_PRICE (default $5,000) for a year of PPC AdGrid.
//   • Premium PPC users are matched 1:1 to advertisers (N advertisers ⇒ at most N premium users).
//   • A matched user receives a FIXED advance of PREMIUM_ADVANCE_AMOUNT ($1,460) as in-store
//     credit. The platform keeps the rest ($5,000 − $1,460 = $3,540).
//   • The user repays their advance by staying active: on any day the user does not earn
//     DAILY_MIN_EARN ($8), their card is charged MISSED_DAY_CHARGE ($8), until the $1,460 is repaid.
//   • Of each $8 charged, the business is credited BUSINESS_REFUND_PER_DAY ($4) as STORE CREDIT
//     (the "50% refund" = half of the $8); the platform keeps the other $4.
//   • On top of that, the business receives SOCIAL_CREDIT_PER_DAY ($32) in free social-media ad
//     credit — until the advertiser has DOUBLED their investment (received $10,000 in orders).
//   • Businesses spend refund store credit (and any in-store credit) on products AND online
//     services via AI order fulfillment, with NO markup on refunded credits.
//
// SAFETY: real card charges only happen when PREMIUM_PPC_LIVE_CHARGES=1. Off by default, so the
// whole flow runs end-to-end in test mode (charges are simulated, ledgers still update) until the
// owner deliberately turns it on after confirming their payment processor allows this. This is an
// operational safety catch to protect the Stripe account — NOT legal advice or a compliance sign-off.

export const PPC_GRID_ANNUAL_PRICE = Number(Deno.env.get("PPC_GRID_ANNUAL_PRICE") ?? "5000");
// The upfront advance is a FIXED dollar amount (not a % of the grid): the user receives $1,460
// and the platform keeps the rest ($5,000 − $1,460 = $3,540).
export const PREMIUM_ADVANCE_AMOUNT = Number(Deno.env.get("PREMIUM_ADVANCE_AMOUNT") ?? "1460");
export const DAILY_MIN_EARN = Number(Deno.env.get("PREMIUM_DAILY_MIN_EARN") ?? "8");
export const MISSED_DAY_CHARGE = Number(Deno.env.get("PREMIUM_MISSED_DAY_CHARGE") ?? "8");
// The "50% refund": each missed day the business is credited HALF of the $8 charge ($4) as STORE
// CREDIT; the platform keeps the other $4. Social-media ad credit is granted on top.
export const BUSINESS_REFUND_PER_DAY = Number(Deno.env.get("PREMIUM_BUSINESS_REFUND_PER_DAY") ?? "4");
export const SOCIAL_CREDIT_PER_DAY = Number(Deno.env.get("PREMIUM_SOCIAL_CREDIT_PER_DAY") ?? "32");
// Ads + social credits run until the advertiser DOUBLES their investment — i.e. receives
// DOUBLING_MULTIPLE × the grid price in fulfilled product/service orders ($5,000 × 2 = $10,000).
export const DOUBLING_MULTIPLE = Number(Deno.env.get("PREMIUM_DOUBLING_MULTIPLE") ?? "2");

/** The fixed upfront advance ($1,460 in store credit). */
export const advanceLimit = () => round2(PREMIUM_ADVANCE_AMOUNT);
/** Order value at which the advertiser has "doubled" and free social/ads stop ($10,000). */
export const doublingTarget = () => round2(PPC_GRID_ANNUAL_PRICE * DOUBLING_MULTIPLE);
/** What the platform keeps of each missed-day charge ($8 − $4 = $4). */
export const platformKeepPerDay = () => round2(MISSED_DAY_CHARGE - BUSINESS_REFUND_PER_DAY);
/** Has the advertiser doubled their investment? (received ≥ $10,000 in fulfilled orders.) */
export function hasDoubled(ordersValueDelivered?: number): boolean {
  return round2(ordersValueDelivered ?? 0) >= doublingTarget();
}

/** Real charges enabled? Off by default → simulate (no card is touched). */
export function liveChargesEnabled(): boolean {
  return (Deno.env.get("PREMIUM_PPC_LIVE_CHARGES") ?? "0") === "1";
}

export function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/** UTC calendar day (YYYY-MM-DD) for "did they earn today" checks. */
export function utcDay(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

export type ChargeResult =
  | { ok: true; simulated: true; amount: number; id: string }
  | { ok: true; simulated: false; amount: number; id: string; status: string }
  | { ok: false; simulated: boolean; amount: number; error: string };

/**
 * Charge a saved card OFF-SESSION (user not present) by reusing the Stripe customer +
 * payment method captured at enrollment. When live charges are disabled this SIMULATES the
 * charge (returns ok+simulated, touches no card) so the ledger logic can be exercised safely.
 */
export async function chargeSavedCardOffSession(opts: {
  customerId?: string | null;
  paymentMethodId?: string | null;
  amount: number; // dollars
  description: string;
  metadata?: Record<string, string>;
}): Promise<ChargeResult> {
  const amount = round2(opts.amount);
  if (amount <= 0) return { ok: false, simulated: !liveChargesEnabled(), amount, error: "amount must be > 0" };

  if (!liveChargesEnabled()) {
    // Test mode: no real charge. Deterministic simulated id (no RNG).
    return { ok: true, simulated: true, amount, id: `sim_${opts.metadata?.user_id ?? "user"}_${utcDay()}` };
  }

  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  if (!stripeKey) return { ok: false, simulated: false, amount, error: "STRIPE_SECRET_KEY not set" };
  if (!opts.customerId || !opts.paymentMethodId) {
    return { ok: false, simulated: false, amount, error: "no saved card on file for this member" };
  }

  const params = new URLSearchParams({
    amount: String(Math.round(amount * 100)),
    currency: "usd",
    customer: opts.customerId,
    payment_method: opts.paymentMethodId,
    off_session: "true",
    confirm: "true",
    description: opts.description,
  });
  for (const [k, v] of Object.entries(opts.metadata ?? {})) params.set(`metadata[${k}]`, v);

  const r = await fetch("https://api.stripe.com/v1/payment_intents", {
    method: "POST",
    headers: { authorization: `Bearer ${stripeKey}`, "content-type": "application/x-www-form-urlencoded" },
    body: params,
  });
  const j = await r.json();
  if (!r.ok || j.error) {
    return { ok: false, simulated: false, amount, error: j?.error?.message ?? `Stripe ${r.status}` };
  }
  return { ok: true, simulated: false, amount, id: j.id, status: j.status };
}
