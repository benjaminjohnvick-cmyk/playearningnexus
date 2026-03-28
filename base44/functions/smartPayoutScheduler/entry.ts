import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Intelligent payout batcher that groups approved earnings by tier, 
 * withdrawal frequency, and platform liquidity to minimize bank fees.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    let callerIsAdmin = false;
    try {
      const user = await base44.auth.me();
      callerIsAdmin = user?.role === 'admin';
    } catch (_) {
      callerIsAdmin = true; // scheduled call
    }
    if (!callerIsAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { dry_run = false, min_batch_size = 3, platform_liquidity_limit = 5000 } = body;

    // Fetch all users with pending approved balances
    const [users, allPayouts, tierRecords] = await Promise.all([
      base44.asServiceRole.entities.User.list(),
      base44.asServiceRole.entities.Payout.list('-created_date', 1000),
      base44.asServiceRole.entities.PPCUserTier.list(),
    ]);

    const tierMap = {};
    tierRecords.forEach(t => { tierMap[t.user_id] = t; });

    // Group users by payment method and tier for batch optimization
    const batches = {}; // key: `${method}_tier${tier}` → array of payout candidates

    let totalLiquidityUsed = 0;
    const candidates = [];

    for (const user of users) {
      const balance = user.current_balance || 0;
      if (balance < 5) continue; // skip micro-balances

      const prefs = await base44.asServiceRole.entities.PayoutPreference.filter({ user_id: user.id });
      const pref = prefs[0];
      if (!pref?.is_verified) continue; // only verified accounts

      // Check withdrawal frequency history
      const userPayouts = allPayouts.filter(p => p.user_id === user.id && p.status === 'completed');
      const lastPayout = userPayouts[0];
      const daysSinceLastPayout = lastPayout
        ? Math.floor((Date.now() - new Date(lastPayout.created_date)) / 86400000)
        : 999;

      // Skip if paid out too recently (< 7 days) unless high-tier
      const userTier = tierMap[user.id]?.current_tier || 1;
      const minDaysBetweenPayouts = userTier >= 3 ? 1 : userTier >= 2 ? 3 : 7;
      if (daysSinceLastPayout < minDaysBetweenPayouts) continue;

      // Check if already has pending payout
      const hasPending = allPayouts.some(p => p.user_id === user.id && ['pending', 'processing'].includes(p.status));
      if (hasPending) continue;

      const method = pref?.payout_method || 'paypal';
      const threshold = pref?.minimum_payout_threshold || 50;
      if (balance < threshold) continue;

      // Fee optimization: higher amounts → prioritize to hit batch minimum
      const feeEstimate = method === 'paypal' ? Math.min(balance * 0.029 + 0.30, 20) :
                          method === 'stripe' ? balance * 0.0025 :
                          method === 'bank_transfer' ? 3.00 : 1.50;

      candidates.push({
        user_id: user.id,
        email: pref?.paypal_email || pref?.bank_email || user.email,
        amount: balance,
        method,
        tier: userTier,
        threshold,
        fee_estimate: feeEstimate,
        days_since_last_payout: daysSinceLastPayout,
        priority_score: (userTier * 20) + (daysSinceLastPayout / 10) + (balance / 100),
      });
    }

    // Sort by priority score descending
    candidates.sort((a, b) => b.priority_score - a.priority_score);

    // Group into batches by method
    const methodBatches = {};
    for (const c of candidates) {
      if (totalLiquidityUsed + c.amount > platform_liquidity_limit) continue; // liquidity cap
      if (!methodBatches[c.method]) methodBatches[c.method] = [];
      methodBatches[c.method].push(c);
      totalLiquidityUsed += c.amount;
    }

    const results = [];
    let totalScheduled = 0;
    let totalAmount = 0;
    let totalFeeSavings = 0;

    for (const [method, batch] of Object.entries(methodBatches)) {
      if (batch.length < min_batch_size && batch.every(c => c.tier < 3)) {
        // Hold small batches unless tier-3 users
        results.push({ method, status: 'held', reason: `Only ${batch.length} users (need ${min_batch_size} for batch)`, users: batch.length });
        continue;
      }

      const batchTotal = batch.reduce((s, c) => s + c.amount, 0);
      const individualFees = batch.reduce((s, c) => s + c.fee_estimate, 0);
      // Batch transfer fees are typically cheaper
      const batchFee = method === 'bank_transfer' ? 5.00 :
                       method === 'paypal' ? batch.length * 0.50 : individualFees * 0.7;
      const feeSavings = individualFees - batchFee;

      if (!dry_run) {
        const estimatedArrival = new Date();
        estimatedArrival.setDate(estimatedArrival.getDate() + (method === 'bank_transfer' ? 3 : 1));

        for (const c of batch) {
          await base44.asServiceRole.entities.Payout.create({
            user_id: c.user_id,
            recipient_type: 'user',
            recipient_id: c.user_id,
            recipient_email: c.email,
            amount: c.amount,
            currency: 'USD',
            method: c.method,
            payout_type: 'smart_batch',
            status: 'pending',
            description: `Smart batch payout — Tier ${c.tier} · ${method} · batch of ${batch.length}`,
            notes: JSON.stringify({
              batch_size: batch.length,
              batch_total: batchTotal,
              fee_savings: feeSavings.toFixed(2),
              priority_score: c.priority_score,
              estimated_arrival: estimatedArrival.toISOString(),
              scheduled_at: new Date().toISOString(),
            }),
          });
        }
      }

      results.push({
        method,
        status: dry_run ? 'dry_run' : 'scheduled',
        users: batch.length,
        total_amount: batchTotal,
        fee_savings: feeSavings.toFixed(2),
        tier_breakdown: { t1: batch.filter(c => c.tier === 1).length, t2: batch.filter(c => c.tier === 2).length, t3: batch.filter(c => c.tier === 3).length },
      });
      totalScheduled += batch.length;
      totalAmount += batchTotal;
      totalFeeSavings += feeSavings;
    }

    return Response.json({
      success: true,
      dry_run,
      total_candidates: candidates.length,
      total_scheduled: totalScheduled,
      total_amount: totalAmount.toFixed(2),
      total_fee_savings: totalFeeSavings.toFixed(2),
      liquidity_used: totalLiquidityUsed.toFixed(2),
      batches: results,
    });
  } catch (error) {
    console.error('smartPayoutScheduler error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});