import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { dispute_id } = await req.json();
    if (!dispute_id) return Response.json({ error: 'dispute_id required' }, { status: 400 });

    // Fetch dispute and related data in parallel
    const disputeArr = await base44.asServiceRole.entities.SurveyDispute.filter({ id: dispute_id });
    const dispute = disputeArr[0];
    if (!dispute) return Response.json({ error: 'Dispute not found' }, { status: 404 });

    const [responseArr, trustArr] = await Promise.all([
      dispute.response_id
        ? base44.asServiceRole.entities.PPCSurveyResponse.filter({ id: dispute.response_id })
        : Promise.resolve([]),
      base44.asServiceRole.entities.RespondentTrustScore.filter({ user_id: dispute.user_id }),
    ]);

    const surveyResponse = responseArr[0] || null;
    const trustScore = trustArr[0] || null;

    // Build evidence summary
    const evidence = {
      dispute_type: dispute.dispute_type || 'missing_credit',
      appeal_reason: dispute.appeal_reason,
      user_description: dispute.description,
      expected_amount: dispute.expected_amount,
      screenshot_provided: !!dispute.screenshot_url,
      transaction_id: dispute.transaction_id,
      quality_score_at_time: dispute.quality_score_at_time,
      fraud_reasons_at_time: dispute.fraud_reasons_at_time || [],
    };

    const responseEvidence = surveyResponse ? {
      quality_score: surveyResponse.quality_score,
      time_taken_seconds: surveyResponse.time_taken_seconds,
      completed: surveyResponse.completed,
      fraud_risk_score: surveyResponse.fraud_risk_score,
      fraud_reasons: surveyResponse.fraud_reasons || [],
      fraud_action: surveyResponse.fraud_action,
      quality_penalties: surveyResponse.quality_penalties || [],
      is_flagged: surveyResponse.is_flagged,
      is_blocked: surveyResponse.is_blocked,
    } : null;

    const userHistory = trustScore ? {
      overall_trust_score: trustScore.overall_trust_score,
      trust_tier: trustScore.trust_tier,
      total_responses: trustScore.total_responses_count,
      flagged_count: trustScore.flagged_responses_count,
      flag_rate: trustScore.total_responses_count > 0
        ? ((trustScore.flagged_responses_count / trustScore.total_responses_count) * 100).toFixed(1) + '%'
        : '0%',
    } : null;

    const prompt = `You are an AI dispute resolution agent for a PPC survey marketplace.
Analyze this dispute and make a resolution recommendation.

PLATFORM RULES:
- Surveys with fraud_risk_score > 70 are blocked and ineligible for payout
- Surveys with quality_score < 50 may be penalized  
- Completion time < 10s for a 5+ question survey is flagged as "too_fast"
- Users with trust_tier "low" have additional scrutiny applied
- Screenshot evidence adds credibility to missing credit claims
- Technical errors (connection issues, server problems) should be credited if credible

DISPUTE DETAILS:
${JSON.stringify(evidence, null, 2)}

SURVEY RESPONSE DATA:
${responseEvidence ? JSON.stringify(responseEvidence, null, 2) : 'No linked response found'}

USER TRUST HISTORY:
${userHistory ? JSON.stringify(userHistory, null, 2) : 'No trust score on record'}

DECISION FRAMEWORK:
- AUTO_APPROVE: Clear technical error, high trust user, no fraud signals, screenshot provided
- AUTO_REJECT: High fraud risk score, multiple fraud reasons, too_fast flag with no explanation, low trust user
- ESCALATE: Ambiguous case, moderate signals on both sides, disputed amount > $5, requires human judgment

Provide your analysis and recommendation.`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          decision: { type: 'string' }, // AUTO_APPROVE | AUTO_REJECT | ESCALATE
          confidence: { type: 'number' }, // 0-100
          recommended_credit_amount: { type: 'number' },
          reasoning: { type: 'string' },
          key_factors: { type: 'array', items: { type: 'string' } },
          rule_violations_found: { type: 'array', items: { type: 'string' } },
          user_credibility_assessment: { type: 'string' }
        }
      }
    });

    // Map AI decision to dispute status
    let newStatus = 'reviewing';
    if (result.decision === 'AUTO_APPROVE') newStatus = 'approved';
    else if (result.decision === 'AUTO_REJECT') newStatus = 'rejected';
    // ESCALATE → stays 'reviewing' for human

    const analysisNote = [
      `🤖 AI Decision: ${result.decision} (${result.confidence}% confidence)`,
      `📋 Reasoning: ${result.reasoning}`,
      result.key_factors?.length ? `✅ Key Factors: ${result.key_factors.join('; ')}` : '',
      result.rule_violations_found?.length ? `⚠️ Rule Violations: ${result.rule_violations_found.join('; ')}` : '',
      `👤 User Credibility: ${result.user_credibility_assessment || 'N/A'}`,
    ].filter(Boolean).join('\n');

    await base44.asServiceRole.entities.SurveyDispute.update(dispute_id, {
      status: newStatus,
      admin_notes: analysisNote,
      resolved_amount: result.decision === 'AUTO_APPROVE' ? (result.recommended_credit_amount || dispute.expected_amount || 0) : 0,
      resolved_by: 'AI Agent',
      resolved_date: newStatus !== 'reviewing' ? new Date().toISOString() : undefined,
    });

    // Send notification to user
    if (newStatus === 'approved' || newStatus === 'rejected') {
      await base44.asServiceRole.entities.Notification.create({
        user_id: dispute.user_id,
        type: newStatus === 'approved' ? 'payout_processed' : 'status_changed',
        title: newStatus === 'approved' ? '✅ Dispute Auto-Approved' : '❌ Dispute Decision',
        message: newStatus === 'approved'
          ? `Your dispute was automatically approved by AI review. $${(result.recommended_credit_amount || 0).toFixed(2)} will be credited.`
          : `Your dispute was reviewed by AI. ${result.reasoning?.slice(0, 120)}`,
        status: 'unread',
        delivery_method: ['in_app'],
      });
    }

    return Response.json({
      success: true,
      decision: result.decision,
      new_status: newStatus,
      confidence: result.confidence,
      reasoning: result.reasoning,
      credit_amount: result.recommended_credit_amount,
    });
  } catch (error) {
    console.error('aiDisputeReview error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});