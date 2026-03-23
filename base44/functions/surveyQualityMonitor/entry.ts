import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * AI Quality Monitor — runs periodically or on-demand per survey.
 * - Calculates rolling quality metrics
 * - Auto-pauses survey if quality drops below threshold
 * - Generates AI suggestions to improve targeting / question phrasing
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Can be called by scheduler (service role) or by creator
    let userId = null;
    let isScheduled = false;
    try {
      const user = await base44.auth.me();
      userId = user?.id;
    } catch {
      isScheduled = true; // called from automation without user token
    }

    const { survey_id } = await req.json();

    // If scheduled (no user), process ALL active surveys
    if (!survey_id && isScheduled) {
      const activeSurveys = await base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' });
      const results = [];
      for (const s of activeSurveys) {
        const r = await monitorSurvey(base44, s.id, s);
        results.push({ survey_id: s.id, ...r });
      }
      return Response.json({ success: true, processed: results.length, results });
    }

    if (!survey_id) return Response.json({ error: 'survey_id required' }, { status: 400 });

    const surveys = await base44.asServiceRole.entities.PPCSurvey.filter({ id: survey_id });
    if (!surveys[0]) return Response.json({ error: 'Survey not found' }, { status: 404 });

    const result = await monitorSurvey(base44, survey_id, surveys[0]);
    return Response.json({ success: true, survey_id, ...result });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

async function monitorSurvey(base44, surveyId, survey) {
  // Fetch recent responses (last 50)
  const allResponses = await base44.asServiceRole.entities.PPCSurveyResponse.filter(
    { survey_id: surveyId, completed: true }, '-created_date', 50
  );

  if (allResponses.length < 5) {
    return { action: 'none', reason: 'Insufficient data (need ≥5 responses)', suggestions: [] };
  }

  // Calculate metrics
  const scored = allResponses.filter(r => r.quality_score != null);
  const avgQuality = scored.length > 0
    ? scored.reduce((s, r) => s + r.quality_score, 0) / scored.length
    : 100;

  const blocked = allResponses.filter(r => r.is_blocked).length;
  const flagged = allResponses.filter(r => r.is_flagged).length;
  const fraudRate = (blocked + flagged) / allResponses.length;

  const completed = allResponses.filter(r => r.completed).length;
  const completionRate = allResponses.length > 0 ? completed / allResponses.length : 1;

  const avgTime = allResponses.filter(r => r.time_taken_seconds > 0)
    .reduce((s, r, _, arr) => s + r.time_taken_seconds / arr.length, 0);

  const metrics = {
    avg_quality: Math.round(avgQuality),
    fraud_rate: Math.round(fraudRate * 100),
    completion_rate: Math.round(completionRate * 100),
    avg_time_seconds: Math.round(avgTime),
    sample_count: allResponses.length,
  };

  // Thresholds
  const QUALITY_THRESHOLD = 45;
  const FRAUD_THRESHOLD = 40; // percent
  const COMPLETION_THRESHOLD = 30; // percent

  const shouldPause =
    avgQuality < QUALITY_THRESHOLD ||
    fraudRate * 100 > FRAUD_THRESHOLD ||
    completionRate * 100 < COMPLETION_THRESHOLD;

  // Build context for AI suggestions
  const answerDistributions = {};
  survey.questions?.forEach((q, qi) => {
    const counts = { a: 0, b: 0, c: 0, d: 0 };
    allResponses.forEach(r => {
      const ans = r.answers?.find(a => a.question_index === qi);
      if (ans?.selected_option) counts[ans.selected_option]++;
    });
    answerDistributions[qi] = { question: q.question, counts };
  });

  const aiPrompt = `You are a survey quality optimization expert. Analyze this survey's performance data and provide actionable improvement suggestions.

Survey: "${survey.title}"
Survey Type: ${survey.survey_type}

Performance Metrics:
- Average Data Quality Score: ${metrics.avg_quality}/100 (threshold: ${QUALITY_THRESHOLD})
- Fraud/Suspicious Rate: ${metrics.fraud_rate}% (threshold: ${FRAUD_THRESHOLD}%)  
- Completion Rate: ${metrics.completion_rate}% (threshold: ${COMPLETION_THRESHOLD}%)
- Average Time to Complete: ${metrics.avg_time_seconds}s
- Responses Analyzed: ${metrics.sample_count}

Question Answer Distributions (looking for straight-lining or poor discrimination):
${Object.entries(answerDistributions).slice(0, 5).map(([qi, d]) =>
  `Q${parseInt(qi) + 1}: "${d.question.slice(0, 60)}" — A:${d.counts.a} B:${d.counts.b} C:${d.counts.c} D:${d.counts.d}`
).join('\n')}

Survey was ${shouldPause ? 'AUTO-PAUSED' : 'kept active'} due to quality metrics.

Provide:
1. Root cause analysis of quality issues (2-3 sentences)
2. 3-5 specific, actionable suggestions to improve data quality and completion rate
3. 2-3 specific question rephrasing suggestions if any questions show poor answer distribution
4. A recommended next action

Be specific and practical.`;

  const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: aiPrompt,
    response_json_schema: {
      type: 'object',
      properties: {
        root_cause: { type: 'string' },
        suggestions: { type: 'array', items: { type: 'string' } },
        question_improvements: { type: 'array', items: { type: 'string' } },
        recommended_action: { type: 'string' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
      }
    }
  });

  // Auto-pause if thresholds breached
  let action = 'none';
  if (shouldPause && survey.status === 'active') {
    await base44.asServiceRole.entities.PPCSurvey.update(surveyId, { status: 'paused' });
    action = 'paused';

    // Notify creator
    if (survey.creator_user_id) {
      await base44.asServiceRole.entities.Notification.create({
        user_id: survey.creator_user_id,
        type: 'survey_paused',
        title: '⚠️ Survey Auto-Paused',
        message: `"${survey.title}" was paused due to quality issues (avg score: ${metrics.avg_quality}/100, fraud rate: ${metrics.fraud_rate}%). Check your dashboard for AI improvement suggestions.`,
        status: 'unread',
        delivery_method: ['in_app'],
      });
    }
  }

  // Save quality report to the survey record
  await base44.asServiceRole.entities.PPCSurvey.update(surveyId, {
    avg_quality_score: metrics.avg_quality,
  });

  return {
    action,
    metrics,
    should_pause: shouldPause,
    ai_analysis: aiResult,
  };
}