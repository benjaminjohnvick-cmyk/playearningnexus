import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const today = new Date().toISOString().split('T')[0];
    const tierRecords = await base44.asServiceRole.entities.PPCUserTier.filter({});
    let processed = 0;

    for (const tr of tierRecords) {
      const updates = {};

      // Tier 1 → Check if user earned $3 today via DailyEarnings
      if (tr.current_tier === 1) {
        const todayEarnings = await base44.asServiceRole.entities.DailyEarnings.filter({
          user_id: tr.user_id, date: today
        });
        const earned = todayEarnings[0]?.total_earned || 0;
        if (earned >= 3) {
          updates.tier1_days_active = (tr.tier1_days_active || 0) + 1;
          if ((tr.tier1_days_active || 0) + 1 >= 365) {
            updates.tier1_completed = true;
            updates.current_tier = 2;
            updates.tier2_start_date = today;
          }
        }
        // Also check referral earnings path
        const referralEarnings = await base44.asServiceRole.entities.PPCTransaction.filter({
          user_id: tr.user_id, transaction_type: 'referral_commission'
        });
        const totalRef = referralEarnings.reduce((s, t) => s + (t.amount || 0), 0);
        updates.tier1_referral_earnings = totalRef;
        if (totalRef >= 2190 && tr.current_tier === 1) {
          updates.tier1_completed = true;
          updates.current_tier = 2;
          updates.tier2_start_date = today;
        }
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.PPCUserTier.update(tr.id, updates);
        processed++;
      }
    }

    return Response.json({ success: true, processed, total: tierRecords.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});