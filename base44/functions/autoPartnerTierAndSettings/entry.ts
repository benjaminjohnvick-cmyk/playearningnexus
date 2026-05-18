import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Auto-manages partner tiers, notification prefs, payout settings for all users
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
    let tiersUpdated = 0;
    let settingsApplied = 0;

    for (const user of users) {
      const referrals = await base44.asServiceRole.entities.Referral.filter({ referrer_user_id: user.id });
      const referralCount = referrals.length;
      const totalEarnings = user.total_earnings || 0;

      // Auto-determine partner tier
      let newTier = 'bronze';
      if (referralCount >= 100 || totalEarnings >= 500) newTier = 'platinum';
      else if (referralCount >= 50 || totalEarnings >= 200) newTier = 'gold';
      else if (referralCount >= 10 || totalEarnings >= 50) newTier = 'silver';

      if (user.partner_tier !== newTier) {
        await base44.asServiceRole.entities.User.update(user.id, { partner_tier: newTier });
        tiersUpdated++;
      }

      // Auto-set payout preference if missing
      const existingPref = await base44.asServiceRole.entities.PayoutPreference.filter({ user_id: user.id });
      if (existingPref.length === 0 && user.email) {
        await base44.asServiceRole.entities.PayoutPreference.create({
          user_id: user.id,
          payout_method: 'paypal',
          paypal_email: user.email,
          auto_payout_enabled: true,
        });
        settingsApplied++;
      }

      // Ensure smart notification rules exist for the user
      const existingRules = await base44.asServiceRole.entities.SmartNotificationRule.filter({ user_id: user.id });
      if (existingRules.length === 0) {
        await base44.asServiceRole.entities.SmartNotificationRule.create({
          user_id: user.id,
          rule_name: 'Default Earnings Alert',
          trigger_type: 'earnings_milestone',
          threshold: 10,
          channel: 'email',
          is_active: true,
        });
        settingsApplied++;
      }
    }

    return Response.json({ success: true, tiersUpdated, settingsApplied });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});