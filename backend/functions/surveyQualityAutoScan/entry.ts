import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Survey Quality Auto-Scanner
 * Runs daily — auto-scores recent survey responses,
 * flags low-quality surveys, logs all actions to AgentPerformanceLog.
 * Closes the loop: score → log → verify → learn.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let callerIsAdmin = false;
    try { const u = await base44.auth.me(); callerIsAdmin = u?.role === 'admin'; } catch (_) { callerIsAdmin = true; }
    if (!callerIsAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { lookback_hours = 24 } = body;

    const since = new Date(Date.now() - lookback_hours * 60 * 60 * 1000).toISOString();

    // Get recent responses that haven't been quality-scored yet
    const responses = await base44.asServiceRole.entities.PPCSurveyResponse.list('-created_date', 300);
    const unscored = responses.filter(r => r.created_date > since && !r.auto_quality_checked);

    if (unscored.length === 0) {
      return Response.json({ success: true, message: 'No unscored responses to process', scanned: 0 });
    }

    // Get approved quality-monitor learnings
    const memories = await base44.asServiceRole.entities.AgentLearningMemory.filter(
      { agent_name: 'survey_quality_monitor', admin_approved: true, is_active: true }
    );
    const learnedCriteria = memories.map(m => m.content).join('\n');

    let scored = 0;
    let flagged = 0;
    const summaryByScore = { high: 0, medium: 0, low: 0 };

    // Process in batches of 20 to use LLM efficiently
    const batches = [];
    for (let i = 0; i < unscored.length; i += 20) {
      batches.push(unscored.slice(i, i + 20));
    }

    for (const batch of batches.slice(0, 5)) { // max 5 batches = 100 responses per run
      const batchData = batch.map(r => ({
        id: r.id,
        completion_time_seconds: r.completion_time_seconds,
        answers_count: (r.answers || []).length,
        existing_quality_score: r.quality_score,
        fraud_reasons: r.fraud_reasons || []
      }));

      let batchAssessment;
      try {
        batchAssessment = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are GamerGain's survey quality monitor. Score these survey responses.

RESPONSES TO SCORE:
${JSON.stringify(batchData, null, 2)}

LEARNED QUALITY CRITERIA:
${learnedCriteria || 'Use standard criteria: completion time > 30s = good, answers completeness, fraud signals present = low quality.'}

For each response, assign a quality tier: "high" (score 70-100), "medium" (40-69), "low" (0-39).
Flag responses with quality < 40 as needing review.

Return JSON: { "scores": [{ "id": "...", "quality_tier": "high|medium|low", "adjusted_score": 0-100, "flag_for_review": true/false, "reason": "..." }] }`,
          response_json_schema: {
            type: 'object',
            properties: {
              scores: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    quality_tier: { type: 'string' },
                    adjusted_score: { type: 'number' },
                    flag_for_review: { type: 'boolean' },
                    reason: { type: 'string' }
                  }
                }
              }
            }
          }
        });
      } catch (_) {
        // Fallback heuristic scoring
        batchAssessment = {
          scores: batch.map(r => {
            const time = r.completion_time_seconds || 0;
            const score = Math.min(100, Math.max(0, time > 120 ? 85 : time > 60 ? 65 : time > 30 ? 45 : 20));
            return {
              id: r.id,
              quality_tier: score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low',
              adjusted_score: score,
              flag_for_review: score < 40,
              reason: `Completion time: ${time}s`
            };
          })
        };
      }

      for (const score of (batchAssessment.scores || [])) {
        summaryByScore[score.quality_tier] = (summaryByScore[score.quality_tier] || 0) + 1;
        if (score.flag_for_review) flagged++;

        // Update response record
        await base44.asServiceRole.entities.PPCSurveyResponse.update(score.id, {
          quality_score: score.adjusted_score,
          auto_quality_checked: true,
          quality_tier: score.quality_tier
        });
        scored++;
      }
    }

    // Log the scan run to AgentPerformanceLog
    await base44.asServiceRole.entities.AgentPerformanceLog.create({
      agent_name: 'survey_quality_monitor',
      action_type: 'quality_scan',
      target_entity: 'PPCSurveyResponse',
      target_id: 'batch',
      input_data: { lookback_hours, responses_processed: scored },
      output_data: { by_tier: summaryByScore, flagged },
      predicted_outcome: `${flagged} responses flagged for review out of ${scored} scanned`,
      confidence_score: 80,
      human_review_status: 'pending',
      tags: ['quality_scan', 'auto_run', `flagged_${flagged}`]
    });

    return Response.json({
      success: true,
      scanned: unscored.length,
      scored,
      flagged,
      by_tier: summaryByScore
    });
  } catch (error) {
    console.error('surveyQualityAutoScan error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});