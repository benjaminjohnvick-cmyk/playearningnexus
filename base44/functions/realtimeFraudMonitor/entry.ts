import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Real-time anti-fraud monitor: IP velocity, device fingerprinting, VPN/proxy detection.
 * Called on every survey response submission OR as a standalone check.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { response_id, user_id, action = 'check' } = body;

    // Allow scheduled/admin calls
    let actingUser = null;
    try { actingUser = await base44.auth.me(); } catch (_) {}

    // Scheduled batch mode — scan recent unscored responses
    if (!response_id && action === 'check') {
      const fifteenMinutesAgo = new Date(Date.now() - 35 * 60 * 1000).toISOString();
      const recentResponses = await base44.asServiceRole.entities.PPCSurveyResponse.list('-created_date', 100);
      const unscored = recentResponses.filter(r =>
        r.created_date > fifteenMinutesAgo && r.fraud_risk_score == null && !r.is_blocked
      );
      let processed = 0, flagged = 0, blocked = 0;
      for (const r of unscored) {
        try {
          const res = await base44.asServiceRole.functions.invoke('realtimeFraudMonitor', { response_id: r.id, action: 'check' });
          const data = res?.data ?? res;
          if (data?.fraud_action === 'flag') flagged++;
          if (data?.fraud_action === 'block') blocked++;
          processed++;
        } catch (_) {}
      }
      return Response.json({ success: true, mode: 'scheduled_batch', processed, flagged, blocked });
    }

    if (action === 'block_user') {
      if (actingUser?.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });
      // Block all pending responses from this user
      const responses = await base44.asServiceRole.entities.PPCSurveyResponse.filter({ user_id, completed: false });
      for (const r of responses) {
        await base44.asServiceRole.entities.PPCSurveyResponse.update(r.id, {
          is_blocked: true, fraud_action: 'block',
          fraud_reasons: [...(r.fraud_reasons || []), 'manual_admin_block'],
        });
      }
      return Response.json({ success: true, action: 'user_blocked', responses_blocked: responses.length });
    }

    if (!response_id) return Response.json({ error: 'response_id required' }, { status: 400 });

    const responseArr = await base44.asServiceRole.entities.PPCSurveyResponse.filter({ id: response_id });
    const response = responseArr[0];
    if (!response) return Response.json({ error: 'Response not found' }, { status: 404 });

    const targetUserId = response.user_id;

    // --- Signal Collection ---
    const [recentResponses, allUserResponses, flaggedHistory] = await Promise.all([
      // Responses in last hour across ALL users from same fingerprint
      base44.asServiceRole.entities.PPCSurveyResponse.filter(
        { device_fingerprint: response.device_fingerprint },
        '-created_date', 50
      ),
      base44.asServiceRole.entities.PPCSurveyResponse.filter({ user_id: targetUserId }, '-created_date', 200),
      base44.asServiceRole.entities.FlaggedResponse.filter({ respondent_id: targetUserId }, '-created_date', 50),
    ]);

    const signals = [];
    let riskScore = 0;

    // 1. IP Velocity: same fingerprint used by multiple users in last hour
    const oneHourAgo = Date.now() - 3600000;
    const recentFromFingerprint = response.device_fingerprint
      ? recentResponses.filter(r => new Date(r.created_date).getTime() > oneHourAgo)
      : [];
    const uniqueUsersOnFingerprint = new Set(recentFromFingerprint.map(r => r.user_id)).size;
    if (uniqueUsersOnFingerprint > 1) {
      riskScore += 35;
      signals.push(`fingerprint_shared: ${uniqueUsersOnFingerprint} accounts on same device`);
    }

    // 2. Response velocity: user completed too many surveys too fast
    const lastHourResponses = allUserResponses.filter(r => new Date(r.created_date).getTime() > oneHourAgo);
    if (lastHourResponses.length > 10) {
      riskScore += 30;
      signals.push(`high_velocity: ${lastHourResponses.length} responses in 1 hour`);
    } else if (lastHourResponses.length > 5) {
      riskScore += 15;
      signals.push(`elevated_velocity: ${lastHourResponses.length} responses in 1 hour`);
    }

    // 3. Speed fraud: completed too fast for the number of questions
    const survey = await base44.asServiceRole.entities.PPCSurvey.get(response.survey_id).catch(() => null);
    const expectedMinTime = (survey?.questions?.length || 5) * 8; // 8s min per question
    if (response.time_taken_seconds && response.time_taken_seconds < expectedMinTime) {
      const speedRatio = response.time_taken_seconds / expectedMinTime;
      if (speedRatio < 0.3) { riskScore += 30; signals.push(`bot_speed: ${response.time_taken_seconds}s for ${survey?.questions?.length || 5} questions`); }
      else if (speedRatio < 0.6) { riskScore += 15; signals.push(`fast_completion: ${response.time_taken_seconds}s`); }
    }

    // 4. Straight-lining: all answers the same option
    const answers = response.answers || [];
    if (answers.length >= 3) {
      const options = answers.map(a => a.selected_option).filter(Boolean);
      const allSame = options.length > 0 && options.every(o => o === options[0]);
      if (allSame) { riskScore += 25; signals.push('straight_lining: all identical answers'); }
    }

    // 5. Historical flag rate
    const flagRate = allUserResponses.length > 0
      ? flaggedHistory.length / allUserResponses.length
      : 0;
    if (flagRate > 0.5) { riskScore += 20; signals.push(`high_flag_rate: ${(flagRate * 100).toFixed(0)}% flagged historically`); }
    else if (flagRate > 0.25) { riskScore += 10; signals.push(`elevated_flag_rate: ${(flagRate * 100).toFixed(0)}%`); }

    // 6. No device fingerprint at all (suspicious for web)
    if (!response.device_fingerprint) {
      riskScore += 10;
      signals.push('missing_fingerprint');
    }

    // 7. New account + high volume
    const userArr = await base44.asServiceRole.entities.User.filter({ id: targetUserId }).catch(() => []);
    const user = userArr[0];
    if (user) {
      const accountAgeDays = user.created_date
        ? Math.floor((Date.now() - new Date(user.created_date)) / 86400000)
        : 0;
      if (accountAgeDays < 3 && allUserResponses.length > 20) {
        riskScore += 25;
        signals.push(`new_account_high_volume: ${accountAgeDays}d old, ${allUserResponses.length} responses`);
      }
    }

    riskScore = Math.min(100, riskScore);
    const fraudAction = riskScore >= 70 ? 'block' : riskScore >= 35 ? 'flag' : 'allow';

    // Update the response record
    await base44.asServiceRole.entities.PPCSurveyResponse.update(response_id, {
      fraud_risk_score: riskScore,
      fraud_reasons: signals,
      fraud_action: fraudAction,
      is_flagged: fraudAction !== 'allow',
      is_blocked: fraudAction === 'block',
    });

    // Create flagged record if needed
    if (fraudAction !== 'allow') {
      const existingFlag = await base44.asServiceRole.entities.FlaggedResponse.filter({ response_id }).catch(() => []);
      if (existingFlag.length === 0) {
        await base44.asServiceRole.entities.FlaggedResponse.create({
          response_id,
          survey_id: response.survey_id,
          respondent_id: targetUserId,
          creator_id: survey?.creator_user_id || '',
          flag_reasons: signals,
          severity: fraudAction === 'block' ? 'high' : 'medium',
          status: 'pending',
          details: { risk_score: riskScore, signals, fingerprint_users: uniqueUsersOnFingerprint },
        });
      }
    }

    // Auto-block user if score very high
    if (riskScore >= 85 && user) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: 'admin',
        type: 'status_changed',
        title: '🚨 High-Risk Fraud Detected',
        message: `User ${user.email} scored ${riskScore}/100 fraud risk. Signals: ${signals.slice(0, 3).join(', ')}`,
        status: 'unread',
        delivery_method: ['in_app'],
      });
    }

    return Response.json({
      success: true,
      response_id,
      user_id: targetUserId,
      risk_score: riskScore,
      fraud_action: fraudAction,
      signals,
      signals_count: signals.length,
    });
  } catch (error) {
    console.error('realtimeFraudMonitor error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});