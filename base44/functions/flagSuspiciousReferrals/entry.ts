import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Run as admin to scan for risk patterns
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Unauthorized' }, { status: 403 });

    // Scan for high-velocity signups (>5 signups from same IP in 1 hour)
    const recentSignups = await base44.asServiceRole.entities.Referral.filter({ status: 'active' });
    const ipClusters = {};
    
    recentSignups.forEach(ref => {
      if (!ref.referrer_ip) return;
      const hourAgo = new Date(Date.now() - 3600000);
      if (new Date(ref.created_date) > hourAgo) {
        if (!ipClusters[ref.referrer_ip]) ipClusters[ref.referrer_ip] = [];
        ipClusters[ref.referrer_ip].push(ref);
      }
    });

    const flagsCreated = [];

    // Check for suspicious clusters
    for (const [ip, refs] of Object.entries(ipClusters)) {
      if (refs.length > 5) {
        const referrer = recentSignups.find(r => r.referrer_ip === ip);
        if (referrer) {
          const flag = await base44.asServiceRole.entities.ReferralRiskFlag.create({
            referrer_user_id: referrer.referrer_user_id,
            referrer_name: referrer.referrer_name,
            referrer_email: referrer.referrer_email,
            risk_type: 'high_velocity_signups',
            risk_score: Math.min(100, refs.length * 10),
            flagged_referrals_count: refs.length,
            suspicious_details: { ip, signup_count: refs.length, timeframe: '1 hour' },
            auto_suspended: refs.length > 10,
            suspension_reason: refs.length > 10 ? 'High-velocity signup pattern detected' : null,
            flagged_at: new Date().toISOString(),
            status: 'active',
          });
          flagsCreated.push(flag);

          // Auto-suspend if extreme
          if (refs.length > 10) {
            await base44.asServiceRole.entities.User.update(referrer.referrer_user_id, {
              account_suspended: true,
              suspension_reason: 'Referral fraud detected',
            });
          }
        }
      }
    }

    // Check for non-converting active referrals (active 30+ days, 0 surveys)
    const allReferrals = await base44.asServiceRole.entities.Referral.filter({});
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
    
    const referrerActivity = {};
    allReferrals.forEach(ref => {
      if (!ref.referrer_user_id) return;
      if (!referrerActivity[ref.referrer_user_id]) referrerActivity[ref.referrer_user_id] = { total: 0, active: 0, non_converting: 0 };
      referrerActivity[ref.referrer_user_id].total++;
      
      const isSurveyActive = new Date(ref.created_date) > thirtyDaysAgo;
      const hasSurveys = ref.surveys_completed > 0;
      
      if (isSurveyActive && !hasSurveys) {
        referrerActivity[ref.referrer_user_id].non_converting++;
      }
      if (isSurveyActive) {
        referrerActivity[ref.referrer_user_id].active++;
      }
    });

    for (const [referrerId, activity] of Object.entries(referrerActivity)) {
      const nonConversionRate = activity.total > 0 ? activity.non_converting / activity.active : 0;
      if (nonConversionRate > 0.8 && activity.active > 10) {
        const referrer = allReferrals.find(r => r.referrer_user_id === referrerId);
        if (referrer) {
          const flag = await base44.asServiceRole.entities.ReferralRiskFlag.create({
            referrer_user_id: referrerId,
            referrer_name: referrer.referrer_name,
            referrer_email: referrer.referrer_email,
            risk_type: 'non_converting_active',
            risk_score: Math.min(100, Math.round(nonConversionRate * 100)),
            flagged_referrals_count: activity.non_converting,
            suspicious_details: { non_converting: activity.non_converting, active: activity.active, rate: nonConversionRate },
            flagged_at: new Date().toISOString(),
            status: 'active',
          });
          flagsCreated.push(flag);
        }
      }
    }

    return Response.json({
      success: true,
      flags_created: flagsCreated.length,
      flags: flagsCreated,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});