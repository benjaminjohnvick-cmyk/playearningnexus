import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Computes a trust score (0-100) for a user based on:
 *  - Claim approvals vs denials (40 pts max)
 *  - Referral quality/active rate (35 pts max)
 *  - Survey completion / response quality (25 pts max)
 * 
 * Payload: { user_id, recalculate_all } (recalculate_all=true for scheduled job)
 */
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const body = await req.json().catch(() => ({}));

  // Auth check for non-scheduled calls
  let callerIsAdmin = false;
  try {
    const caller = await base44.auth.me();
    callerIsAdmin = caller?.role === 'admin';
    // Allow user to recalculate their own score
    if (!callerIsAdmin && body.user_id && caller?.id !== body.user_id) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
  } catch {
    // Allow service-role calls (from scheduled automation)
    if (!body._service_call) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const computeForUser = async (userId) => {
    const [claims, referrals, trustRecord] = await Promise.all([
      base44.asServiceRole.entities.DisputeClaim.filter({ user_id: userId }),
      base44.asServiceRole.entities.Referral.filter({ referrer_user_id: userId }),
      base44.asServiceRole.entities.RespondentTrustScore.filter({ user_id: userId }).then(r => r[0] || null),
    ]);

    // ── Claim Score (40 pts) ──────────────────────────────────────────
    const totalClaims = claims.length;
    const approvedClaims = claims.filter(c => c.status === 'approved').length;
    const deniedClaims = claims.filter(c => c.status === 'denied').length;

    let claimScore = 30; // neutral base
    if (totalClaims > 0) {
      const approvalRate = approvedClaims / totalClaims;
      const denialRate = deniedClaims / totalClaims;
      claimScore = Math.round(40 * approvalRate - 20 * denialRate);
      claimScore = Math.max(0, Math.min(40, claimScore));
    }

    // ── Referral Quality Score (35 pts) ───────────────────────────────
    const totalReferrals = referrals.length;
    const activeReferrals = referrals.filter(r => r.status === 'active').length;
    const qualityReferrals = referrals.filter(r => (r.quality_score || 0) >= 70).length;

    let referralScore = 0;
    if (totalReferrals > 0) {
      const activeRate = activeReferrals / totalReferrals;
      const qualityRate = qualityReferrals / totalReferrals;
      // Scale: 10 pts for having referrals, 15 pts for activity, 10 pts for quality
      referralScore = Math.round(
        Math.min(10, totalReferrals * 1) +   // up to 10 pts for volume
        15 * activeRate +                      // 15 pts for active rate
        10 * qualityRate                       // 10 pts for quality rate
      );
      referralScore = Math.min(35, referralScore);
    }

    // ── Survey Quality Score (25 pts) ─────────────────────────────────
    // Use existing RespondentTrustScore data if present
    const existingResponseQuality = trustRecord?.response_quality_score || 0;
    const flaggedCount = trustRecord?.flagged_responses_count || 0;
    const totalResponses = trustRecord?.total_responses_count || 0;

    let surveyScore = 12; // neutral
    if (totalResponses > 0) {
      const flagRate = flaggedCount / totalResponses;
      surveyScore = Math.round((existingResponseQuality / 100) * 20 + (1 - flagRate) * 5);
      surveyScore = Math.max(0, Math.min(25, surveyScore));
    }

    // ── Composite Score ───────────────────────────────────────────────
    const overallScore = Math.min(100, claimScore + referralScore + surveyScore);

    // ── Tier Classification ───────────────────────────────────────────
    let trust_tier;
    if (overallScore >= 80) trust_tier = 'premium';
    else if (overallScore >= 60) trust_tier = 'high';
    else if (overallScore >= 35) trust_tier = 'medium';
    else trust_tier = 'low';

    // ── Upsert RespondentTrustScore ───────────────────────────────────
    const scoreData = {
      user_id: userId,
      overall_trust_score: overallScore,
      trust_tier,
      last_calculated_at: new Date().toISOString(),
      // preserve existing sub-scores, only update what we computed
      ...(trustRecord ? {} : { response_quality_score: 50, time_accuracy_score: 50, flagged_responses_count: 0, total_responses_count: 0 }),
    };

    if (trustRecord) {
      await base44.asServiceRole.entities.RespondentTrustScore.update(trustRecord.id, scoreData);
    } else {
      await base44.asServiceRole.entities.RespondentTrustScore.create(scoreData);
    }

    return { userId, overallScore, trust_tier, claimScore, referralScore, surveyScore };
  };

  // Batch recalculate all (for scheduled job)
  if (body.recalculate_all && callerIsAdmin) {
    const users = await base44.asServiceRole.entities.User.list('-created_date', 500);
    const results = await Promise.allSettled(users.map(u => computeForUser(u.id)));
    const success = results.filter(r => r.status === 'fulfilled').length;
    return Response.json({ updated: success, total: users.length });
  }

  // Single user
  const userId = body.user_id;
  if (!userId) return Response.json({ error: 'user_id required' }, { status: 400 });

  const result = await computeForUser(userId);
  return Response.json(result);
});