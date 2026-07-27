import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { featureAllowed } from "../../sdk/jurisdiction.ts";

// sweepstakesFreeEntry — the NO-PURCHASE-NECESSARY (AMOE) path into the current weekly prize pool.
// Grants ONE free entry per period per user, with the SAME eligibility and odds as a paid entry.
// Offering a genuine free entry breaks the "consideration" prong, which keeps the prize pool a legal
// sweepstakes rather than a lottery. Jurisdiction- and age-gated exactly like the paid entry.
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    // Same gates as the paid entry.
    const __jur = user.jurisdiction ?? user.state ?? null;
    if (!featureAllowed("jackpots", __jur)) {
      return Response.json({ error: "Prize competitions aren't available in your location." }, { status: 403 });
    }
    if (user.age_verified_18plus !== true) {
      return Response.json({ error: "You must verify you're 18 or older to enter." }, { status: 403 });
    }

    const actives = await base44.asServiceRole.entities.ReferralJackpot.filter({ status: "active" }, "-created_date", 1);
    const tournament = actives[0];
    const period = tournament?.period || new Date().toISOString().slice(0, 7);

    // One free entry per user per period (no purchase necessary; not stackable with itself).
    const existingFree = await base44.asServiceRole.entities.ReferralJackpot.filter({ status: "active", user_id: user.id, is_free_entry: true });
    if ((existingFree || []).length > 0) {
      return Response.json({ error: "You have already used your free entry for this period.", already_entered: true }, { status: 409 });
    }

    await base44.asServiceRole.entities.ReferralJackpot.create({
      period, status: "active", is_skill_based: true, ranking_metric: "performance_score",
      user_id: user.id, user_email: user.email,
      jackpot_entries_earned: 1, entry_fee_paid: 0, is_paid_entry: false, is_free_entry: true, amoe: true,
      created_at: new Date().toISOString(),
    });

    return Response.json({
      success: true, free_entry: true,
      note: "Free entry recorded (no purchase necessary). Same odds and eligibility as a paid entry; winners are ranked by performance.",
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
