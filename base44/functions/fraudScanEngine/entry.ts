import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Automated Fraud Scan Engine
 * Runs daily — scans recent survey responses for fraud signals,
 * logs all detections to AgentPerformanceLog for verification loop.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let callerIsAdmin = false;
    try { const u = await base44.auth.me(); callerIsAdmin = u?.role === 'admin'; } catch (_) { callerIsAdmin = true; }
    if (!callerIsAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { lookback_hours = 24, max_responses = 500 } = body;

    // Fetch recent survey responses
    const since = new Date(Date.now() - lookback_hours * 60 * 60 * 1000).toISOString();
    const responses = await base44.asServiceRole.entities.PPCSurveyResponse.list('-created_date', max_responses);
    const recentResponses = responses.filter(r => r.created_date > since);

    if (recentResponses.length === 0) {
      return Response.json({ success: true, scanned: 0, flagged: 0 });
    }

    // Get existing fraud reports to avoid double-flagging
    const existingReports = await base44.asServiceRole.entities.FraudReport.list('-created_date', 200);
    const existingUserIds = new Set(existingReports.map(r => r.user_id));

    // Gather approved learning memories for fraud_detection agent
    const memories = await base44.asServiceRole.entities.AgentLearningMemory.filter(
      { agent_name: 'fraud_detection', admin_approved: true, is_active: true }
    );
    const learnedPatterns = memories.map(m => m.content).join('\n');

    // Group by user to detect behavioral patterns
    const byUser = {};
    for (const r of recentResponses) {
      if (!byUser[r.user_id]) byUser[r.user_id] = [];
      byUser[r.user_id].push(r);
    }

    let flagged = 0;
    const detections = [];

    for (const [userId, userResponses] of Object.entries(byUser)) {
      const fraudSignals = [];

      // Signal 1: Speed — too fast completions
      const fastResponses = userResponses.filter(r => (r.completion_time_seconds || 999) < 15);
      if (fastResponses.length > 0) fraudSignals.push(`${fastResponses.length} responses completed in < 15s`);

      // Signal 2: Volume — too many surveys in short window
      if (userResponses.length > 20) fraudSignals.push(`${userResponses.length} surveys in ${lookback_hours}h`);

      // Signal 3: All straight-line answers (same quality scores)
      const qualityScores = userResponses.map(r => r.quality_score).filter(Boolean);
      if (qualityScores.length > 5) {
        const uniqueScores = new Set(qualityScores);
        if (uniqueScores.size === 1) fraudSignals.push('Straight-lining detected: identical quality scores');
      }

      // Signal 4: Very low quality scores
      const lowQuality = userResponses.filter(r => r.quality_score && r.quality_score < 20);
      if (lowQuality.length >= 3) fraudSignals.push(`${lowQuality.length} responses with quality score < 20`);

      if (fraudSignals.length === 0) continue;

      // Use LLM to assess fraud probability
      let aiAssessment;
      try {
        aiAssessment = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `You are GamerGain's fraud detection AI. Assess if this user is fraudulent.

USER ID: ${userId}
RESPONSE COUNT IN ${lookback_hours}H: ${userResponses.length}
FRAUD SIGNALS DETECTED: ${fraudSignals.join(', ')}
QUALITY SCORES: ${qualityScores.slice(0, 10).join(', ')}
COMPLETION TIMES (sec): ${userResponses.slice(0,10).map(r => r.completion_time_seconds || 'N/A').join(', ')}

LEARNED PATTERNS FROM PAST FRAUD CASES:
${learnedPatterns || 'No patterns yet — use standard heuristics.'}

Assess fraud probability and recommended action.
Return JSON: { "fraud_probability": 0-100, "is_likely_fraud": true/false, "reason": "...", "recommended_action": "flag|monitor|ignore", "confidence": "high|medium|low" }`,
          response_json_schema: {
            type: 'object',
            properties: {
              fraud_probability: { type: 'number' },
              is_likely_fraud: { type: 'boolean' },
              reason: { type: 'string' },
              recommended_action: { type: 'string' },
              confidence: { type: 'string' }
            }
          }
        });
      } catch (_) {
        aiAssessment = {
          fraud_probability: fraudSignals.length * 25,
          is_likely_fraud: fraudSignals.length >= 2,
          reason: fraudSignals.join('; '),
          recommended_action: fraudSignals.length >= 2 ? 'flag' : 'monitor',
          confidence: 'medium'
        };
      }

      // Log to AgentPerformanceLog for verification loop
      const logEntry = await base44.asServiceRole.entities.AgentPerformanceLog.create({
        agent_name: 'fraud_detection',
        action_type: 'fraud_flag',
        target_entity: 'User',
        target_id: userId,
        input_data: { signals: fraudSignals, response_count: userResponses.length, quality_scores: qualityScores.slice(0, 10) },
        output_data: aiAssessment,
        predicted_outcome: aiAssessment.is_likely_fraud ? 'User is fraudulent' : 'User is legitimate',
        confidence_score: aiAssessment.confidence === 'high' ? 90 : aiAssessment.confidence === 'medium' ? 65 : 40,
        human_review_status: 'pending',
        tags: ['fraud_scan', `confidence_${aiAssessment.confidence}`, aiAssessment.recommended_action]
      });

      // Create fraud report if flagged and not already existing
      if (aiAssessment.is_likely_fraud && !existingUserIds.has(userId)) {
        await base44.asServiceRole.entities.FraudReport.create({
          user_id: userId,
          reason: aiAssessment.reason,
          fraud_probability: aiAssessment.fraud_probability,
          signals: fraudSignals,
          status: 'pending',
          auto_detected: true,
          agent_log_id: logEntry.id
        });
        flagged++;
      }

      detections.push({ userId, signals: fraudSignals, fraud_probability: aiAssessment.fraud_probability });
    }

    return Response.json({
      success: true,
      scanned: recentResponses.length,
      users_analyzed: Object.keys(byUser).length,
      flagged,
      detections: detections.slice(0, 20)
    });
  } catch (error) {
    console.error('fraudScanEngine error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});