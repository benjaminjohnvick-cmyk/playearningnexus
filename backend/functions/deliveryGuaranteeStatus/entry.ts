import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { db } from "../../sdk/db.ts";
import {
  deliveryGuaranteeEnabled,
  guaranteeTermMonths,
  computeSeatGuarantees,
} from "../../sdk/delivery-guarantee.ts";

// deliveryGuaranteeStatus (auth, read-only) — the caller's advertising DELIVERY guarantee picture, per seat and
// across tiers: how many impressions were guaranteed for the term, how many have actually been delivered,
// whether delivery is on pace, and — at/after term end — any free make-good top-up owed and its progress.
//
// This reflects the ADVERTISING we deliver, which we measure on-platform. It is NOT a revenue or ROI guarantee.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (!deliveryGuaranteeEnabled()) return Response.json({ enabled: false, reason: "delivery guarantee disabled" });

    const seats = await computeSeatGuarantees(db, String(user.id), Date.now());

    return Response.json({
      enabled: true,
      term_months: guaranteeTermMonths(),
      seats,
      has_make_good: seats.some((s) => s.status === "make_good_owed" || s.make_good_active),
      disclaimer: "This guarantees the ADVERTISING we deliver — a defined volume of impressions for your term — " +
        "and if we fall short we make it up with free inventory. It is not a guarantee of revenue, sales, or ROI.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
