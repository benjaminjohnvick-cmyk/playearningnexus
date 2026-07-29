import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";
import { gate } from "../../sdk/oversight.ts";
import { featureAllowed } from "../../sdk/jurisdiction.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // --- Human-in-the-loop oversight gate (auto-added; leaf money/enforcement action) ---
    {
      const __ovBody = await req.clone().json().catch(() => ({}));
      const __ov = await gate({ action: "awardReferralJackpotEntries", amount: Number(__ovBody.amount ?? __ovBody.total ?? __ovBody.payout_amount ?? 0) || 0, agent: __ovBody.agent ?? "automation", summary: "awardReferralJackpotEntries — automated money/enforcement action", payload: __ovBody, evidence: __ovBody.evidence ?? null, approvalToken: __ovBody.approvalToken });
      if (!__ov.proceed) return Response.json({ gated: true, status: "pending_approval", reviewId: __ov.reviewId }, { status: 202 });
    }
    const { referral_id, trigger_type, referrer_user_id } = await req.json();

    if (!referral_id || !trigger_type || !referrer_user_id) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Define entries and badge info by trigger type
    const CONFIG = {
      signup: { entries: 0.5, badge: 'New Referral Signup', icon: '🎮' },
      activated: { entries: 1, badge: 'Referral Activated', icon: '⚡' },
      earning: { entries: 0.1, badge: 'Referral Earning', icon: '💰' }, // per $1 earned
    };

    const config = CONFIG[trigger_type];
    if (!config) {
      return Response.json({ error: 'Invalid trigger_type' }, { status: 400 });
    }

    // Sweepstakes eligibility gate (mirrors processWeeklyJackpot's payout gate, applied at ENTRY):
    // only award jackpot entries to 18+ verified users in jurisdictions where prize competitions
    // aren't blocked. Skipping an entry never errors the referral flow — it just doesn't enter the draw.
    const referrer = (await base44.asServiceRole.entities.User.filter({ id: referrer_user_id }))[0] || null;
    if (!referrer) {
      return Response.json({ success: false, skipped: 'referrer_not_found' });
    }
    if (referrer.age_verified_18plus !== true) {
      return Response.json({ success: false, skipped: 'age_unverified', entries_awarded: 0 });
    }
    const referrerJuris = referrer.jurisdiction ?? referrer.state ?? null;
    if (!featureAllowed('jackpots', referrerJuris)) {
      return Response.json({ success: false, skipped: 'feature_blocked_in_jurisdiction', entries_awarded: 0 });
    }

    // Award jackpot entries by creating a ReferralMilestone record
    // (milestone_count: 0 = continuous entries, not tied to 5/25/50/100)
    const entry = await base44.asServiceRole.entities.ReferralMilestone.create({
      user_id: referrer_user_id,
      milestone_count: 0, // 0 = continuous, not a named milestone
      achieved_at: new Date().toISOString(),
      jackpot_entries_awarded: config.entries,
      badge_name: config.badge,
      badge_icon: config.icon,
      reward_claimed: true,
      notified: false,
    });

    return Response.json({ success: true, entry_id: entry.id, entries_awarded: config.entries });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});