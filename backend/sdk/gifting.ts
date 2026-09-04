// gifting.ts — closed-loop Site-Cash gifting. A user moves their non-cashable Site Cash (current_balance,
// USD store credit) to another user. This is store-credit moving BETWEEN accounts — never money, never a
// cash-out — so it stays inside the closed-loop / non-money-transmission model. The platform keeps a small
// spread (booked as `breakage`); the sender always sees fee + net before confirming.
import { snapBool, snapNumber } from "./settings.ts";

export const giftingEnabled = () => snapBool("SITE_CASH_GIFTING_ENABLED", true);
export const giftFeePct = () => Math.min(0.5, Math.max(0, snapNumber("SITE_CASH_GIFTING_FEE_PCT", 0.10)));
export const giftMinUsd = () => Math.max(0, snapNumber("SITE_CASH_GIFT_MIN_USD", 1));
export const giftMaxUsd = () => Math.max(0, snapNumber("SITE_CASH_GIFT_MAX_USD", 100));

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Split a gross gift into what the recipient receives and the platform's closed-loop spread. */
export function splitGift(grossUsd: number): { gross: number; fee: number; net: number; pct: number } {
  const pct = giftFeePct();
  const gross = round2(Math.max(0, Number(grossUsd) || 0));
  const fee = round2(gross * pct);
  return { gross, fee, net: round2(gross - fee), pct };
}

/** Reason a gift is not allowed (amount bounds / gifting off), or null if it's OK to proceed. */
export function giftBlockedReason(grossUsd: number): string | null {
  if (!giftingEnabled()) return "Gifting isn't available right now.";
  const amt = round2(Number(grossUsd) || 0);
  if (amt <= 0) return "Enter a gift amount.";
  if (amt < giftMinUsd()) return `The minimum gift is $${giftMinUsd().toFixed(2)}.`;
  if (amt > giftMaxUsd()) return `The maximum gift is $${giftMaxUsd().toFixed(2)}.`;
  return null;
}
