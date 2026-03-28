import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Background AI Integrity Monitor
 * Triggered on every PPCSurveyResponse create event.
 * Checks:
 *   1. Earning velocity (too many responses per hour / day)
 *   2. Rapid response time (bot speed)
 *   3. Straight-lining (identical answers)
 *   4. Suspicious IP / device fingerprint changes
 *   5. AI holistic risk score
 * Actions: flag response, create FlaggedResponse, pause account if high severity.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const response = body.data;

    if (!response?.user_id || !response?.id) return Response.json({ skipped: true });

    const userId = response.user_id;
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const oneDayAgo  = new Date(now - 24 * 60 * 60 * 1000).toISOString();
    const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Fetch all user responses + current survey in parallel
    const [allUserResponses, surveyResult] = await Promise.all([
      base44.asServiceRole.entities.PPCSurveyResponse.filter({ user_id: userId }, '-created_date', 200),
      response.survey_id
        ? base44.asServiceRole.entities.PPCSurvey.filter({ id: response.survey_id })
        : Promise.resolve([]),
    ]);

    const survey = surveyResult[0] || null;
    const lastHour = allUserResponses.filter(r => r.created_date > oneHourAgo);
    const lastDay  = allUserResponses.filter(r => r.created_date > oneDayAgo);
    const lastWeek = allUserResponses.filter(r => r.created_date > oneWeekAgo);

    const flags = [];
    const flagCodes = [];

    // ── 1. Earning velocity ───────────────────────────────────────────────────
    if (lastHour.length > 8) {
      flags.push(`High velocity: ${lastHour.length} responses in 1 hour (max 8)`);
      flagCodes.push('too_fast');
    }
    if (lastDay.length > 30) {
      flags.push(`Daily velocity: ${lastDay.length} responses today (max 30)`);
      flagCodes.push('too_fast');
    }

    // ── 2. Rapid response time ────────────────────────────────────────────────
    const qCount = response.answers?.length || survey?.questions?.length || 3;
    const minExpectedSeconds = qCount * 7; // at least 7s per question
    if (response.time_taken_seconds && response.time_taken_seconds < minExpectedSeconds) {
      flags.push(`Too fast: ${response.time_taken_seconds}s for ${qCount} questions (min ~${minExpectedSeconds}s)`);
      flagCodes.push('too_fast');
    }

    // ── 3. Straight-lining ────────────────────────────────────────────────────
    const choiceAnswers = (response.answers || []).map(a => a.selected_option).filter(Boolean);
    if (choiceAnswers.length >= 3 && choiceAnswers.every(o => o === choiceAnswers[0])) {
      flags.push('Straight-lining: all answers identical');
      flagCodes.push('duplicate_pattern');
    }

    // ── 4. IP / device fingerprint change detection ───────────────────────────
    const currentFingerprint = response.device_fingerprint;
    if (currentFingerprint && lastWeek.length > 0) {
      const knownFingerprints = new Set(
        lastWeek.filter(r => r.device_fingerprint).map(r => r.device_fingerprint)
      );
      // More than 2 distinct fingerprints in a week = suspicious
      if (knownFingerprints.size >= 3 && !knownFingerprints.has(currentFingerprint)) {
        flags.push(`Suspicious device changes: ${knownFingerprints.size + 1} different devices/IPs in 7 days`);
        flagCodes.push('inconsistent_answers');
      }
    }

    // ── 5. Impossible answer pattern ─────────────────────────────────────────
    // Check if answers alternate perfectly a-b-a-b (bot pattern)
    if (choiceAnswers.length >= 6) {
      let alternating = true;
      for (let i = 2; i < choiceAnswers.length; i++) {
        if (choiceAnswers[i] !== choiceAnswers[i - 2]) { alternating = false; break; }
      }
      if (alternating && choiceAnswers[0] !== choiceAnswers[1]) {
        flags.push('Bot pattern detected: perfectly alternating answers');
        flagCodes.push('impossible_answers');
      }
    }

    // ── No flags → clean ─────────────────────────────────────────────────────
    if (flags.length === 0) return Response.json({ clean: true });

    // ── Severity & action ─────────────────────────────────────────────────────
    const severity   = flags.length >= 3 ? 'high' : flags.length === 2 ? 'medium' : 'low';
    const action     = severity === 'high' ? 'block' : 'flag';
    const shouldPause = severity === 'high';

    // ── AI holistic risk assessment ───────────────────────────────────────────
    let aiRiskScore = flags.length * 20; // base score from rule hits
    try {
      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Survey integrity monitor. Rate overall fraud risk 0-100.
User: ${userId}
Flags detected: ${flags.join('; ')}
Responses last hour: ${lastHour.length}, last day: ${lastDay.length}
Time taken: ${response.time_taken_seconds}s for ${qCount} questions
Existing account flags: ${allUserResponses.filter(r => r.is_flagged).length} flagged responses previously.
Return just a JSON with fraud_risk_score (number 0-100).`,
        response_json_schema: {
          type: 'object',
          properties: { fraud_risk_score: { type: 'number' } }
        }
      });
      aiRiskScore = aiResult.fraud_risk_score ?? aiRiskScore;
    } catch {
      // AI call optional — rule-based score already set
    }

    // ── Update the response record ────────────────────────────────────────────
    await base44.asServiceRole.entities.PPCSurveyResponse.update(response.id, {
      is_flagged:        action !== 'allow',
      is_blocked:        action === 'block',
      fraud_action:      action,
      fraud_risk_score:  aiRiskScore,
      fraud_reasons:     flags,
    });

    // ── Create FlaggedResponse record ─────────────────────────────────────────
    const uniqueFlagCodes = [...new Set(flagCodes)];
    const validCodes      = ['too_fast', 'too_slow', 'inconsistent_answers', 'duplicate_pattern', 'impossible_answers'];
    await base44.asServiceRole.entities.FlaggedResponse.create({
      response_id:   response.id,
      survey_id:     response.survey_id,
      respondent_id: userId,
      creator_id:    survey?.creator_user_id || null,
      flag_reasons:  uniqueFlagCodes.filter(c => validCodes.includes(c)),
      severity,
      details: {
        velocity_flags:   flags,
        hourly_count:     lastHour.length,
        daily_count:      lastDay.length,
        ai_risk_score:    aiRiskScore,
        device_fingerprint: currentFingerprint || null,
      },
      status: 'pending',
    });

    // ── If high severity: mark user account as paused ─────────────────────────
    if (shouldPause) {
      // Store pause flag on the user record via a RespondentTrustScore
      const trustRecords = await base44.asServiceRole.entities.RespondentTrustScore.filter({ user_id: userId });
      if (trustRecords.length > 0) {
        await base44.asServiceRole.entities.RespondentTrustScore.update(trustRecords[0].id, {
          overall_trust_score: Math.min(trustRecords[0].overall_trust_score || 50, 10),
          trust_tier: 'low',
          flagged_responses_count: (trustRecords[0].flagged_responses_count || 0) + 1,
          last_calculated_at: new Date().toISOString(),
        });
      } else {
        await base44.asServiceRole.entities.RespondentTrustScore.create({
          user_id:                   userId,
          overall_trust_score:       10,
          trust_tier:                'low',
          flagged_responses_count:   1,
          total_responses_count:     allUserResponses.length,
          last_calculated_at:        new Date().toISOString(),
        });
      }
    }

    // ── Notify user ───────────────────────────────────────────────────────────
    await base44.asServiceRole.entities.Notification.create({
      user_id:         userId,
      type:            'status_changed',
      title:           shouldPause ? '⚠️ Account Temporarily Paused' : '⚠️ Response Under Review',
      message: shouldPause
        ? 'Unusual activity patterns were detected on your account. Survey access has been paused pending manual review. Contact support if you believe this is an error.'
        : 'One of your recent survey responses has been flagged for quality review. Please ensure you read each question carefully.',
      status:          'unread',
      delivery_method: ['in_app'],
    });

    console.log(`[IntegrityMonitor] User ${userId} — severity=${severity}, flags=${flags.length}, action=${action}, ai_score=${aiRiskScore}`);
    return Response.json({ flagged: true, severity, action, ai_risk_score: aiRiskScore, flags });

  } catch (error) {
    console.error('[IntegrityMonitor] Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});