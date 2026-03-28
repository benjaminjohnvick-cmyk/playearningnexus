import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Called as entity automation on PPCSurveyResponse create
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const response = body.data;

    if (!response?.user_id) return Response.json({ skipped: true });

    const userId = response.user_id;
    const now = new Date();
    const oneHourAgo = new Date(now - 60 * 60 * 1000).toISOString();
    const oneDayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    // Fetch recent activity in parallel
    const [recentResponses, allResponses, userRecord] = await Promise.all([
      base44.asServiceRole.entities.PPCSurveyResponse.filter({ user_id: userId }),
      base44.asServiceRole.entities.PPCSurveyResponse.filter({ user_id: userId }),
      base44.asServiceRole.entities.User.filter({ id: userId }),
    ]);

    const lastHour = recentResponses.filter(r => r.created_date > oneHourAgo);
    const lastDay = allResponses.filter(r => r.created_date > oneDayAgo);
    const user = userRecord[0];

    if (!user) return Response.json({ skipped: true });

    // ── Velocity rules ────────────────────────────────────────────────────────
    const flags = [];

    // 1. Too many responses in last hour (> 8 = suspicious)
    if (lastHour.length > 8) {
      flags.push(`High velocity: ${lastHour.length} responses in 1 hour`);
    }

    // 2. Rapid response time on current response
    const minExpected = (response.answers?.length || 3) * 8; // 8s per question minimum
    if (response.time_taken_seconds && response.time_taken_seconds < minExpected) {
      flags.push(`Too fast: ${response.time_taken_seconds}s for ${response.answers?.length} questions (min ${minExpected}s)`);
    }

    // 3. Straight-lining detection (all same answer)
    if (response.answers?.length >= 3) {
      const opts = response.answers.map(a => a.selected_option).filter(Boolean);
      const allSame = opts.length > 0 && opts.every(o => o === opts[0]);
      if (allSame) flags.push('Straight-lining: identical answers on all questions');
    }

    // 4. Extremely high daily volume (> 30)
    if (lastDay.length > 30) {
      flags.push(`Daily velocity: ${lastDay.length} responses today`);
    }

    if (flags.length === 0) return Response.json({ clean: true });

    const severity = flags.length >= 3 ? 'high' : flags.length === 2 ? 'medium' : 'low';
    const shouldPause = severity === 'high';

    // Flag the response
    await base44.asServiceRole.entities.PPCSurveyResponse.update(response.id, {
      is_flagged: true,
      fraud_reasons: flags,
      fraud_action: shouldPause ? 'block' : 'flag',
      is_blocked: shouldPause,
    });

    // Create a FlaggedResponse record
    await base44.asServiceRole.entities.FlaggedResponse.create({
      response_id: response.id,
      survey_id: response.survey_id,
      respondent_id: userId,
      flag_reasons: ['too_fast', 'duplicate_pattern', 'inconsistent_answers'].slice(0, flags.length),
      severity,
      details: { velocity_flags: flags, hourly_count: lastHour.length, daily_count: lastDay.length },
      status: 'pending',
    });

    // Send in-app notification to user
    await base44.asServiceRole.entities.Notification.create({
      user_id: userId,
      type: 'status_changed',
      title: shouldPause ? '⚠️ Account Temporarily Paused' : '⚠️ Activity Under Review',
      message: shouldPause
        ? 'Unusual activity was detected. Your account has been paused pending review. Contact support if you believe this is an error.'
        : 'Some of your recent responses have been flagged for quality review. Please ensure you are completing surveys carefully.',
      status: 'unread',
      delivery_method: ['in_app'],
    });

    return Response.json({ flagged: true, severity, flags });
  } catch (error) {
    console.error('Velocity monitor error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});