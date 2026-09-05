import { __handler } from "../../sdk/runtime.ts";
import { requireInternalOrAdmin } from "../../sdk/internal-guard.ts";
import {
  foundingEnabled, foundingSlots, foundingSeatsTaken, foundingSlotsRemaining, foundingProgramOpen,
  tier1PostSurveySharePct, foundingSurveyEarnSharePct,
  milestoneState, foundingTermStartsAtMilestone, milestoneUsersReachedAt, foundingFillNoTimeLimit,
} from "../../sdk/founding-advertiser.ts";
import { setSetting } from "../../sdk/settings.ts";

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
    const nowISO = new Date().toISOString();
    const [enrolled, remaining, open, milestone] = await Promise.all([
      foundingSeatsTaken(),
      foundingSlotsRemaining(),
      foundingProgramOpen(),
      milestoneState(nowISO),
    ]);
    const cap = foundingSlots();

    // Stamp the founding benefit-year anchor the FIRST time the 200k-user milestone is reached (so the Tier 1
    // year starts then, not at signup). Idempotent: only writes when the gate is met and no date is stored yet.
    let term_anchor = milestoneUsersReachedAt();
    if (milestone.users_met && !term_anchor) {
      await setSetting("FOUNDING_MILESTONE_USERS_REACHED_AT", nowISO, "foundingProgramMilestone").catch(() => null);
      term_anchor = nowISO;
    }

    return Response.json({
      enabled: foundingEnabled(),
      open,                                   // is the Tier 1 introductory offer still open?
      cap,                                    // availability cap (Tier 1 advertisers)
      enrolled,                               // Tier 1 advertisers enrolled so far
      remaining,                              // seats left before the offer closes
      no_time_limit_to_fill: foundingFillNoTimeLimit(),   // Tier 1 fills with no deadline
      term_starts_at_milestone: foundingTermStartsAtMilestone(),
      users_milestone: { target: milestone.target, current: milestone.current, met: milestone.users_met },
      term_anchor,                            // date the founding benefit year is anchored to ("" until reached)
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
