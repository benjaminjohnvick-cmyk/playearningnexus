import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Survey UX Fraud Analyzer
 *
 * Actions:
 *  - record    : Save a survey UX session with full telemetry
 *  - analyze   : Run AI fraud analysis on a recorded session, compare with baselines
 *  - batch     : Analyze all pending sessions for a survey
 *  - escalate  : Force-escalate a session to admin
 *  - stats     : Return baseline stats for a survey (used for comparison)
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const body = await req.json();
    const { action } = body;

    // ── RECORD ────────────────────────────────────────────────────────────
    if (action === 'record') {
      // Called from frontend during survey — no auth required for recording,
      // but we validate session ownership via user token if present.
      let userId = body.user_id;
      try {
        const user = await base44.auth.me();
        if (user) userId = user.id;
      } catch (_) {}

      if (!userId) return Response.json({ error: 'user_id required' }, { status: 400 });

      const {
        session_id, survey_id, response_id,
        question_timings, mouse_patterns, page_events,
        tab_switches, copy_paste_detected, auto_fill_detected,
        keyboard_shortcut_abuse, device_info, ip_hash,
        session_duration_seconds
      } = body;

      const recording = await base44.asServiceRole.entities.UXSessionRecording.create({
        user_id: userId,
        session_id: session_id || `ux_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        survey_id,
        response_id,
        is_survey_session: true,
        question_timings: question_timings || [],
        mouse_patterns: mouse_patterns || {},
        page_events: page_events || [],
        tab_switches: tab_switches || 0,
        copy_paste_detected: copy_paste_detected || false,
        auto_fill_detected: auto_fill_detected || false,
        keyboard_shortcut_abuse: keyboard_shortcut_abuse || false,
        device_info: device_info || {},
        ip_hash: ip_hash || '',
        session_duration_seconds: session_duration_seconds || 0,
        fraud_analysis_status: 'pending',
        recorded_at: new Date().toISOString()
      });

      // Kick off async analysis (fire and forget)
      base44.asServiceRole.functions.invoke('surveyUXFraudAnalyzer', {
        action: 'analyze',
        recording_id: recording.id
      }).catch(() => {});

      return Response.json({ success: true, recording_id: recording.id });
    }

    // ── ANALYZE ───────────────────────────────────────────────────────────
    if (action === 'analyze') {
      const { recording_id } = body;
      if (!recording_id) return Response.json({ error: 'recording_id required' }, { status: 400 });

      const recs = await base44.asServiceRole.entities.UXSessionRecording.filter({ id: recording_id });
      const rec = recs[0];
      if (!rec) return Response.json({ error: 'Recording not found' }, { status: 404 });

      // Mark as analyzing
      await base44.asServiceRole.entities.UXSessionRecording.update(recording_id, {
        fraud_analysis_status: 'analyzing'
      });

      // Gather baseline: last 100 clean sessions for this survey
      let baseline = [];
      if (rec.survey_id) {
        const allSessions = await base44.asServiceRole.entities.UXSessionRecording.filter(
          { survey_id: rec.survey_id, fraud_analysis_status: 'clean' }, '-created_date', 100
        );
        baseline = allSessions.slice(0, 50);
      }

      // Compute baseline stats
      const baselineStats = computeBaselineStats(baseline);

      // Also pull the linked survey response for cross-reference
      let surveyResponse = null;
      if (rec.response_id) {
        const resps = await base44.asServiceRole.entities.PPCSurveyResponse.filter({ id: rec.response_id }).catch(() => []);
        surveyResponse = resps[0] || null;
      }

      // Previous sessions from same user
      const userHistory = await base44.asServiceRole.entities.UXSessionRecording.filter(
        { user_id: rec.user_id, is_survey_session: true }, '-created_date', 20
      );

      // Build AI prompt
      const prompt = `You are an expert UX fraud analyst for an online survey platform. 
Analyze this survey completion session and determine if it is fraudulent based on behavioral signals.
Compare against known baseline patterns from legitimate completions.

═══ SESSION UNDER REVIEW ═══
Session ID: ${rec.session_id}
Survey ID: ${rec.survey_id || 'unknown'}
Total Duration: ${rec.session_duration_seconds}s
Tab Switches: ${rec.tab_switches}
Copy-Paste Detected: ${rec.copy_paste_detected}
Auto-Fill Detected: ${rec.auto_fill_detected}
Keyboard Shortcut Abuse: ${rec.keyboard_shortcut_abuse}
Device Info: ${JSON.stringify(rec.device_info || {})}

Question Timings (per-question ms to answer):
${JSON.stringify(rec.question_timings || [], null, 2)}

Mouse Patterns:
${JSON.stringify(rec.mouse_patterns || {}, null, 2)}

Page Events (count): ${(rec.page_events || []).length}
First few events: ${JSON.stringify((rec.page_events || []).slice(0, 10))}

═══ LINKED SURVEY RESPONSE ═══
${surveyResponse ? `Quality Score: ${surveyResponse.quality_score}, Fraud Risk: ${surveyResponse.fraud_risk_score}, Reasons: ${JSON.stringify(surveyResponse.fraud_reasons)}` : 'No response data available'}

═══ BASELINE (avg of ${baseline.length} clean sessions) ═══
Avg Duration: ${baselineStats.avgDuration}s
Avg Question Time: ${baselineStats.avgQuestionTime}ms
Avg Tab Switches: ${baselineStats.avgTabSwitches}
Copy-Paste Rate: ${baselineStats.copyPasteRate}%
Auto-Fill Rate: ${baselineStats.autoFillRate}%

═══ USER HISTORY (last ${userHistory.length} sessions) ═══
Previous fraud flags: ${userHistory.filter(s => s.fraud_analysis_status === 'flagged').length}
Avg duration in history: ${userHistory.length > 0 ? Math.round(userHistory.reduce((a, s) => a + (s.session_duration_seconds || 0), 0) / userHistory.length) : 'N/A'}s

═══ FRAUD SIGNALS TO CHECK ═══
1. Speed abuse: completion significantly faster than baseline (< 30% of avg duration)
2. Robotic timing: every question answered in near-identical time (variance < 10%)
3. Tab switching: high count suggests looking up answers or automation
4. Auto-fill / copy-paste: non-human input pattern
5. No mouse movement or erratic bot-like patterns
6. Device anomalies: unusual timezone, headless browser fingerprints
7. Repeat offender: user has multiple prior fraud flags
8. Inconsistency: UX signals contradict each other in suspicious ways

Based on your analysis, decide:
- fraud_score: 0-100 (0=clean, 100=definite fraud)
- verdict: "clean" | "flagged" | "escalate_to_admin"
  * clean: fraud_score < 35
  * flagged: 35-74 — auto-resolve by rejecting response + opening dispute
  * escalate_to_admin: >= 75 OR conflicting signals that AI cannot resolve with high confidence
- confidence: 0.0-1.0
- signals: list of specific fraud signals detected
- ai_reasoning: brief explanation for the record

Return JSON only.`;

      const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            fraud_score: { type: 'number' },
            verdict: { type: 'string' },
            confidence: { type: 'number' },
            signals: { type: 'array', items: { type: 'string' } },
            ai_reasoning: { type: 'string' }
          }
        }
      });

      const { fraud_score = 0, verdict = 'clean', confidence = 0.5, signals = [], ai_reasoning = '' } = aiResult || {};

      // ── VERDICT: CLEAN ─────────────────────────────────────────────────
      if (verdict === 'clean' || fraud_score < 35) {
        await base44.asServiceRole.entities.UXSessionRecording.update(recording_id, {
          fraud_analysis_status: 'clean',
          fraud_score,
          fraud_signals: signals,
          ai_verdict: verdict,
          ai_confidence: confidence,
          resolved: true
        });
        return Response.json({ success: true, verdict: 'clean', fraud_score });
      }

      // ── VERDICT: FLAGGED (auto-resolve) ────────────────────────────────
      if (verdict === 'flagged' || (fraud_score >= 35 && fraud_score < 75)) {
        // Auto-reject the linked survey response
        let disputeId = null;
        if (rec.response_id) {
          const rejectResult = await base44.asServiceRole.functions.invoke('auditSurveyResponses', {
            action: 'reject',
            response_id: rec.response_id,
            reject_reason: `AI UX fraud detection: ${signals.slice(0, 2).join(', ')}. Score: ${fraud_score}/100`
          }).catch(() => null);
          disputeId = rejectResult?.data?.dispute_id || null;
        }

        await base44.asServiceRole.entities.UXSessionRecording.update(recording_id, {
          fraud_analysis_status: 'flagged',
          fraud_score,
          fraud_signals: signals,
          ai_verdict: 'auto_rejected',
          ai_confidence: confidence,
          dispute_id: disputeId,
          resolved: true
        });

        // Update respondent trust score
        await base44.asServiceRole.functions.invoke('computeUserTrustScore', {
          user_id: rec.user_id,
          event: 'fraud_flag',
          fraud_score
        }).catch(() => {});

        return Response.json({ success: true, verdict: 'flagged', fraud_score, dispute_id: disputeId });
      }

      // ── VERDICT: ESCALATE TO ADMIN ─────────────────────────────────────
      // AI cannot resolve with confidence — create admin support ticket
      const adminTicket = await base44.asServiceRole.entities.SupportTicket.create({
        user_id: rec.user_id,
        category: 'technical',
        subject: `[AI Escalation] Survey UX Fraud — Cannot Auto-Resolve (Score: ${fraud_score})`,
        description: `AI fraud analysis could not conclusively resolve this survey session.\n\n` +
          `Session ID: ${rec.session_id}\n` +
          `Survey ID: ${rec.survey_id || 'N/A'}\n` +
          `Response ID: ${rec.response_id || 'N/A'}\n` +
          `Fraud Score: ${fraud_score}/100\n` +
          `AI Confidence: ${Math.round(confidence * 100)}%\n\n` +
          `Detected Signals:\n${signals.map(s => `• ${s}`).join('\n')}\n\n` +
          `AI Reasoning: ${ai_reasoning}\n\n` +
          `Please review the session telemetry and make a manual decision.`,
        status: 'open',
        priority: fraud_score >= 85 ? 'urgent' : 'high',
        escalated_from_ai: true,
        player_data_snapshot: {
          recording_id,
          fraud_score,
          confidence,
          signals,
          question_timings: rec.question_timings,
          device_info: rec.device_info
        }
      });

      await base44.asServiceRole.entities.UXSessionRecording.update(recording_id, {
        fraud_analysis_status: 'escalated',
        fraud_score,
        fraud_signals: signals,
        ai_verdict: 'escalated_to_admin',
        ai_confidence: confidence,
        escalated_to_admin: true,
        admin_ticket_id: adminTicket.id,
        resolved: false
      });

      // Notify admin
      await base44.asServiceRole.functions.invoke('fraudAlertNotifier', {
        type: 'ux_fraud_escalation',
        ticket_id: adminTicket.id,
        recording_id,
        fraud_score,
        ai_reasoning
      }).catch(() => {});

      return Response.json({
        success: true,
        verdict: 'escalated',
        fraud_score,
        admin_ticket_id: adminTicket.id
      });
    }

    // ── BATCH ANALYZE ─────────────────────────────────────────────────────
    if (action === 'batch') {
      const { survey_id, limit = 20 } = body;
      const pending = await base44.asServiceRole.entities.UXSessionRecording.filter(
        { is_survey_session: true, fraud_analysis_status: 'pending', ...(survey_id ? { survey_id } : {}) },
        '-created_date', limit
      );

      let processed = 0;
      for (const rec of pending) {
        await base44.asServiceRole.functions.invoke('surveyUXFraudAnalyzer', {
          action: 'analyze',
          recording_id: rec.id
        }).catch(() => {});
        processed++;
      }

      return Response.json({ success: true, queued: processed, total_pending: pending.length });
    }

    // ── STATS ──────────────────────────────────────────────────────────────
    if (action === 'stats') {
      const { survey_id } = body;
      const filter = survey_id ? { survey_id, is_survey_session: true } : { is_survey_session: true };
      const sessions = await base44.asServiceRole.entities.UXSessionRecording.filter(filter, '-created_date', 500);

      const statusCounts = sessions.reduce((acc, s) => {
        acc[s.fraud_analysis_status] = (acc[s.fraud_analysis_status] || 0) + 1;
        return acc;
      }, {});

      const escalated = sessions.filter(s => s.escalated_to_admin);
      const avgFraudScore = sessions.length
        ? Math.round(sessions.reduce((a, s) => a + (s.fraud_score || 0), 0) / sessions.length)
        : 0;

      return Response.json({
        success: true,
        total: sessions.length,
        by_status: statusCounts,
        escalated_count: escalated.length,
        avg_fraud_score: avgFraudScore,
        recent_escalations: escalated.slice(0, 5).map(s => ({
          id: s.id,
          user_id: s.user_id,
          fraud_score: s.fraud_score,
          signals: s.fraud_signals,
          admin_ticket_id: s.admin_ticket_id,
          created_date: s.created_date
        }))
      });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('surveyUXFraudAnalyzer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function computeBaselineStats(sessions) {
  if (!sessions.length) return { avgDuration: 60, avgQuestionTime: 5000, avgTabSwitches: 0, copyPasteRate: 0, autoFillRate: 0 };
  const n = sessions.length;
  return {
    avgDuration: Math.round(sessions.reduce((a, s) => a + (s.session_duration_seconds || 0), 0) / n),
    avgQuestionTime: Math.round(
      sessions.reduce((a, s) => {
        const qt = s.question_timings || [];
        return a + (qt.length ? qt.reduce((b, q) => b + (q.time_to_answer_ms || 0), 0) / qt.length : 5000);
      }, 0) / n
    ),
    avgTabSwitches: Math.round(sessions.reduce((a, s) => a + (s.tab_switches || 0), 0) / n),
    copyPasteRate: Math.round((sessions.filter(s => s.copy_paste_detected).length / n) * 100),
    autoFillRate: Math.round((sessions.filter(s => s.auto_fill_detected).length / n) * 100)
  };
}