import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
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