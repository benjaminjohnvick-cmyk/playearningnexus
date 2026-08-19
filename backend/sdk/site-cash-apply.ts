// site-cash-apply.ts — automatically apply a buyer's Site Cash to any purchase at checkout.
//
// Site Cash = the user's `points` balance rendered as dollars (1¢/point; POINT_VALUE_CENTS). It is CLOSED-LOOP
// and NON-CASHABLE (POINTS_CASHABLE=0) — it can only be spent on-platform, never withdrawn. This module decides,
// at checkout, how much Site Cash to apply toward a purchase so the buyer pays less card/real money.
//
// GUARDRAILS (unchanged from the manual "apply points" path):
//   • Never more than the purchase total (you can't over-apply and create a cash-out).
//   • Never more than the per-transaction spend cap (`maxPointsPerTransaction`) — the reserve guard that keeps
//     Site Cash from draining the on-platform economy. Auto-apply respects the SAME cap as manual apply.
//   • Never more than the buyer actually holds.
// Auto-apply is a policy default (SITE_CASH_AUTO_APPLY, on) that can be turned off globally; a caller may still
// pass an explicit opt-out per purchase. Pure math here; the caller moves the balance via adjustUserBalance.
import { snapBool } from "./settings.ts";
import { pointValueUsd } from "./revenue.ts";
import { maxPointsPerTransaction } from "./redemption.ts";

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/** Global default: auto-apply Site Cash to purchases (a buyer's own saved preference overrides this). */
export const siteCashAutoApplyEnabled = () => snapBool("SITE_CASH_AUTO_APPLY", true);

/** The per-user preference field on the User entity. A buyer sets this themselves; it wins over the global
 *  default. Unset (undefined/null) → fall back to the global default. */
export const SITE_CASH_AUTO_APPLY_FIELD = "auto_apply_site_cash";

/** Resolve whether to auto-apply Site Cash for THIS buyer: their own saved preference wins; if they haven't
 *  set one, use the global default. Accepts a boolean or "on"/"off" stored value. */
export function resolveSiteCashAutoApply(user: Record<string, unknown> | null | undefined): boolean {
  const pref = user ? (user as Record<string, unknown>)[SITE_CASH_AUTO_APPLY_FIELD] : undefined;
  if (pref === true || pref === false) return pref;
  if (pref === "on" || pref === "off") return pref === "on";
  return siteCashAutoApplyEnabled();
}

export interface SiteCashApplyPlan {
  apply: boolean;             // should any Site Cash be applied?
  points_applied: number;     // points to debit
  points_usd: number;         // dollar value of those points
  face_usd: number;           // the purchase total before Site Cash
  card_after_usd: number;     // remaining to charge to card/real money after Site Cash
  capped_by: "none" | "cap" | "reserve" | "balance" | "total";
  point_usd: number;          // $ value per point used
  note: string;
}

/** Pure: how much Site Cash to auto-apply to a `faceUsd` purchase for a buyer holding `userPoints`.
 *  Mirrors the manual apply-points math (same cap, same valuation) so auto and manual behave identically. */
export function siteCashApplyPlan(opts: {
  faceUsd: number; userPoints: number; isPremium: boolean; reserveSpendablePoints?: number;
}): SiteCashApplyPlan {
  const face = Math.max(0, round2(opts.faceUsd));
  const pointUsd = pointValueUsd();
  const held = Math.max(0, Math.floor(Number(opts.userPoints) || 0));

  // Per-transaction cap (the reserve guard) — identical to the manual apply-points path.
  const cap = maxPointsPerTransaction({ isPremium: !!opts.isPremium, userPoints: held, reserveSpendablePoints: opts.reserveSpendablePoints });
  const pointsForFullFace = pointUsd > 0 ? Math.floor(face / pointUsd) : 0;

  // Bind by: what covers the whole purchase, the spend cap, and the balance held.
  let capped: SiteCashApplyPlan["capped_by"] = "none";
  let points = pointsForFullFace;
  if (cap.points < points) { points = cap.points; capped = cap.limited_by; }        // "cap" or "reserve"
  if (held < points) { points = held; capped = "balance"; }
  if (points >= pointsForFullFace && pointsForFullFace > 0 && capped === "none") capped = "total";
  points = Math.max(0, points);

  const pointsUsd = round2(points * pointUsd);
  const cardAfter = round2(Math.max(0, face - pointsUsd));

  return {
    apply: points > 0,
    points_applied: points,
    points_usd: pointsUsd,
    face_usd: face,
    card_after_usd: cardAfter,
    capped_by: capped,
    point_usd: pointUsd,
    note: points > 0
      ? `Applied $${pointsUsd.toLocaleString()} Site Cash (${points.toLocaleString()} pts); $${cardAfter.toLocaleString()} left to pay.`
      : `No Site Cash applied.`,
  };
}
