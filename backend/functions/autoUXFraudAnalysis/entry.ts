import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { event, data } = payload;

    const sessionId = event?.entity_id || data?.id;
    if (!sessionId) return Response.json({ skipped: true });

    const session = data || await base44.asServiceRole.entities.UXSessionRecording.get(sessionId);
    if (!session || session.fraud_analysis_status === 'clean' || session.fraud_analysis_status === 'escalated') {
      return Response.json({ skipped: true });
    }

    await base44.asServiceRole.entities.UXSessionRecording.update(sessionId, { fraud_analysis_status: 'analyzing' });

    const { InvokeLLM } = base44.asServiceRole.integrations.Core;
    const analysis = await InvokeLLM({
      prompt: `Analyze this UX session for fraud signals:
Tab switches: ${session.tab_switches || 0}
Copy/paste detected: ${session.copy_paste_detected}
Auto-fill detected: ${session.auto_fill_detected}
Keyboard shortcut abuse: ${session.keyboard_shortcut_abuse}
Session duration (seconds): ${session.session_duration_seconds}
Mouse patterns: ${JSON.stringify(session.mouse_patterns || {})}
Is survey session: ${session.is_survey_session}

Score from 0-100 (0=clean, 100=definite fraud). List fraud signals. Give verdict: clean, flagged, or escalated.
Respond with JSON: { "fraud_score": number, "fraud_signals": ["signal1",...], "ai_verdict": "clean|flagged|escalated", "ai_confidence": number }`,
      response_json_schema: {
        type: 'object',
        properties: {
          fraud_score: { type: 'number' },
          fraud_signals: { type: 'array', items: { type: 'string' } },
          ai_verdict: { type: 'string' },
          ai_confidence: { type: 'number' }
        }
      }
    });

    const shouldEscalate = analysis.fraud_score >= 80;
    let ticketId = null;

    if (shouldEscalate) {
      const ticket = await base44.asServiceRole.entities.SupportTicket.create({
        title: `Fraud Alert: UX Session ${session.session_id}`,
        description: `AI detected high fraud score (${analysis.fraud_score}/100) for session ${session.session_id}. Signals: ${analysis.fraud_signals?.join(', ')}`,
        status: 'open',
        priority: 'high'
      });
      ticketId = ticket.id;
    }

    await base44.asServiceRole.entities.UXSessionRecording.update(sessionId, {
      fraud_analysis_status: shouldEscalate ? 'escalated' : (analysis.fraud_score >= 40 ? 'flagged' : 'clean'),
      fraud_score: analysis.fraud_score,
      fraud_signals: analysis.fraud_signals,
      ai_verdict: analysis.ai_verdict,
      ai_confidence: analysis.ai_confidence,
      escalated_to_admin: shouldEscalate,
      admin_ticket_id: ticketId,
      resolved: analysis.fraud_score < 40
    });

    return Response.json({ success: true, fraud_score: analysis.fraud_score, verdict: analysis.ai_verdict });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});