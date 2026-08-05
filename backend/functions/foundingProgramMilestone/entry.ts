import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import {
  foundingEnabled, foundingSlots, foundingSeatsTaken, foundingSlotsRemaining, foundingProgramOpen,
  tier1PostSurveySharePct, foundingSurveyEarnSharePct,
} from "../../sdk/founding-advertiser.ts";

// foundingProgramMilestone (ADMIN / internal) — REPORT-ONLY availability check for the clean Tier 1 offer.
// Safe to run on a schedule.
//
// In the clean Tier 1 model there is NO escrow and NO refund milestone: the presale payment is
// non-refundable and each Tier 1 signup is recorded ACTIVE immediately. This function therefore NO LONGER
// flips any record status or flags refunds — it simply reports whether the Tier 1 introductory offer is
// still open (i.e., the advertiser availability cap hasn't been reached) and the current counts.
//   {} → { enabled, open, cap, enrolled, remaining, in_offer_share, post_offer_share }
export default __handler(async (req) => {
  const guard = await requireInternalOrAdmin(req);
  if (guard) return guard;
  try {
    const [enrolled, remaining, open] = await Promise.all([
      foundingSeatsTaken(),
      foundingSlotsRemaining(),
      foundingProgramOpen(),
    ]);
    const cap = foundingSlots();
    return Response.json({
      enabled: foundingEnabled(),
      open,                                   // is the Tier 1 introductory offer still open?
      cap,                                    // availability cap (Tier 1 advertisers)
      enrolled,                               // Tier 1 advertisers enrolled so far
      remaining,                              // seats left before the offer closes
      in_offer_share: foundingSurveyEarnSharePct(),     // 1.0 — Tier 1 members keep 100% (in-window)
      post_offer_share: tier1PostSurveySharePct(),      // 0.75 — members who join after close keep 75%
      note: open
        ? `Tier 1 open — ${remaining.toLocaleString()} of ${cap.toLocaleString()} advertiser seats remaining. New members keep 100% of their own survey earnings for their window.`
        : `Tier 1 closed — availability cap reached. New members now keep ${Math.round(tier1PostSurveySharePct() * 100)}% of their own survey earnings (platform fee ${Math.round((1 - tier1PostSurveySharePct()) * 100)}%). Existing Tier 1 members are unaffected.`,
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
