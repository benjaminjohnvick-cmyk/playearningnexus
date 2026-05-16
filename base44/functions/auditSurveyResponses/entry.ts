import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

/**
 * Audit Survey Responses
 * Actions:
 *  - scan: AI-scans all responses for a survey, flags suspicious ones
 *  - reject: Business client rejects a specific response → triggers dispute flow for the user
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { action, survey_id, response_id, reject_reason } = body;

    // ── SCAN ──────────────────────────────────────────────────────────────
    if (action === 'scan') {
      if (!survey_id) return Response.json({ error: 'survey_id required' }, { status: 400 });

      const responses = await base44.asServiceRole.entities.PPCSurveyResponse.filter(
        { survey_id, completed: true }, '-created_date', 200
      );

      if (!responses.length) return Response.json({ success: true, flagged: [], total: 0 });

      // Build a compact summary for the AI to analyze
      const responseSummaries = responses.map(r => {
        const textAnswers = Array.isArray(r.answers)
          ? r.answers.filter(a => a.open_text).map(a => a.open_text).join(' | ')
          : (typeof r.answers === 'object' ? Object.values(r.answers).filter(v => typeof v === 'string').join(' | ') : '');
        return {
          id: r.id,
          time_taken_seconds: r.time_taken_seconds || 0,
          quality_score: r.quality_score || 0,
          existing_fraud_risk: r.fraud_risk_score || 0,
          text_answers: textAnswers.substring(0, 300),
          already_flagged: r.is_flagged || false,
          already_blocked: r.is_blocked || false,
        };
      });

      const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are a survey quality AI auditor. Analyze these ${responseSummaries.length} survey responses and flag any that show signs of fraud or low quality.

Patterns to detect:
- Extremely fast completion (< 30 seconds for a multi-question survey)
- Repetitive or copy-pasted text answers (same text across multiple responses)
- Nonsensical or random text (gibberish, keyboard smashing)
- Inconsistent sentiment (e.g. very positive answers contradicted by very negative ones in same response)
- Generic filler text ("good", "yes", "n/a", "nothing" repeated many times)
- Suspiciously perfect/identical pattern selection
- Very short answers where longer ones are expected

Responses:
${JSON.stringify(responseSummaries, null, 2)}

For each flagged response return its id and detected issues. Only flag responses you are confident are problematic.`,
        response_json_schema: {
          type: 'object',
          properties: {
            flagged_responses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  fraud_patterns: { type: 'array', items: { type: 'string' } },
                  severity: { type: 'string' }, // low | medium | high
                  ai_confidence: { type: 'number' },
                  summary: { type: 'string' }
                }
              }
            },
            total_scanned: { type: 'number' },
            clean_count: { type: 'number' },
            scan_summary: { type: 'string' }
          }
        }
      });

      // Persist AI flags back to each response
      const flaggedIds = new Set((analysis?.flagged_responses || []).map(f => f.id));
      for (const flagged of (analysis?.flagged_responses || [])) {
        await base44.asServiceRole.entities.PPCSurveyResponse.update(flagged.id, {
          is_flagged: true,
          fraud_risk_score: Math.round((flagged.ai_confidence || 0.5) * 100),
          fraud_reasons: flagged.fraud_patterns || [],
          fraud_action: flagged.severity === 'high' ? 'flag' : 'flag'
        }).catch(() => {});
      }

      return Response.json({
        success: true,
        total_scanned: responses.length,
        flagged_count: flaggedIds.size,
        flagged_responses: analysis?.flagged_responses || [],
        scan_summary: analysis?.scan_summary || '',
        responses: responses.map(r => ({
          ...r,
          is_flagged: flaggedIds.has(r.id) ? true : r.is_flagged,
          ai_audit: (analysis?.flagged_responses || []).find(f => f.id === r.id) || null
        }))
      });
    }

    // ── REJECT ────────────────────────────────────────────────────────────
    if (action === 'reject') {
      if (!response_id) return Response.json({ error: 'response_id required' }, { status: 400 });

      const responses = await base44.asServiceRole.entities.PPCSurveyResponse.filter({ id: response_id });
      const response = responses[0];
      if (!response) return Response.json({ error: 'Response not found' }, { status: 404 });

      // Mark response as blocked
      await base44.asServiceRole.entities.PPCSurveyResponse.update(response_id, {
        is_blocked: true,
        is_flagged: true,
        fraud_action: 'block',
        fraud_reasons: [...(response.fraud_reasons || []), `Rejected by business client: ${reject_reason || 'Quality issue'}`]
      });

      // Deduct payout if one was issued
      if (response.payout_to_user && response.payout_to_user > 0) {
        const respUser = await base44.asServiceRole.entities.User.filter({ id: response.user_id }).catch(() => []);
        if (respUser[0]) {
          const newBal = Math.max(0, (respUser[0].current_balance || 0) - response.payout_to_user);
          await base44.asServiceRole.entities.User.update(response.user_id, { current_balance: newBal }).catch(() => {});
        }
      }

      // Create SurveyDispute for the respondent (so they can appeal)
      const dispute = await base44.asServiceRole.entities.SurveyDispute.create({
        user_id: response.user_id,
        survey_id: response.survey_id,
        response_id,
        dispute_type: 'response_appeal',
        appeal_reason: 'incorrect_rejection',
        provider: 'ppc',
        description: `Your survey response was rejected by the survey owner. Reason: ${reject_reason || 'Quality standards not met'}. If you believe this is an error, please provide additional context below.`,
        quality_score_at_time: response.quality_score,
        fraud_reasons_at_time: response.fraud_reasons || [],
        expected_amount: response.payout_to_user || 0,
        status: 'pending',
        review_task_created: true
      });

      // Notify the respondent via email
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: response.user_id,
        subject: '⚠️ Survey Response Flagged — You Can Appeal',
        body: `Your recent survey response has been reviewed and rejected by the survey creator.\n\n` +
          `Reason: ${reject_reason || 'Response quality did not meet standards'}\n\n` +
          `A dispute has been automatically opened on your behalf (Dispute ID: ${dispute.id.slice(-6).toUpperCase()}).\n\n` +
          `You may appeal this decision by visiting the Dispute Center. If your appeal is approved, any withheld earnings will be reinstated.\n\n` +
          `<a href="/DisputeCenter">Go to Dispute Center →</a>\n\n— GamerGain Quality Team`
      }).catch(() => {});

      // Notify business client confirmation
      await base44.integrations.Core.SendEmail({
        to: user.email,
        subject: '✅ Response Rejected & Dispute Opened',
        body: `Response ${response_id.slice(-6).toUpperCase()} has been rejected and flagged.\n\nThe respondent has been notified and a dispute ticket (${dispute.id.slice(-6).toUpperCase()}) has been opened for their appeal.\n\n— GamerGain Audit System`
      }).catch(() => {});

      return Response.json({ success: true, dispute_id: dispute.id, response_id });
    }

    // ── LIST (fetch responses with audit data for a survey) ───────────────
    if (action === 'list') {
      if (!survey_id) return Response.json({ error: 'survey_id required' }, { status: 400 });
      const responses = await base44.asServiceRole.entities.PPCSurveyResponse.filter(
        { survey_id }, '-created_date', 200
      );
      return Response.json({ success: true, responses, total: responses.length });
    }

    return Response.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('auditSurveyResponses error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});