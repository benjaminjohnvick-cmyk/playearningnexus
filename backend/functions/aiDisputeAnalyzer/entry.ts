import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { dispute_type, description, file_urls, transaction_id } = await req.json();

    if (!dispute_type || !description) {
      return Response.json({ error: 'dispute_type and description required' }, { status: 400 });
    }

    // Fetch platform logs related to dispute
    let platformEvidence = { transaction_logs: [], referral_logs: [], ux_sessions: [] };

    if (transaction_id) {
      const txns = await base44.asServiceRole.entities.Transaction.filter({
        id: transaction_id,
      });
      platformEvidence.transaction_logs = txns;
    }

    if (dispute_type === 'missing_referral_credit') {
      const referrals = await base44.asServiceRole.entities.Referral.filter({
        referred_user_id: user.id,
      });
      platformEvidence.referral_logs = referrals;
    }

    // Fetch UX session recordings for this user (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const uxSessions = await base44.asServiceRole.entities.UXSessionRecording.filter({
      user_id: user.id,
      recorded_at: { $gte: thirtyDaysAgo }
    }, '-recorded_at', 10);
    
    platformEvidence.ux_sessions = uxSessions.map(session => ({
      session_id: session.session_id,
      duration_seconds: session.session_duration_seconds,
      page_events: session.page_events?.length || 0,
      conversion_funnel: session.conversion_funnel,
      drop_off_point: session.drop_off_point,
      fraud_score: session.fraud_score,
      copy_paste_detected: session.copy_paste_detected,
      auto_fill_detected: session.auto_fill_detected,
      recorded_at: session.recorded_at,
    }));

    // Use AI to analyze evidence
    const analysisPrompt = `
      User Dispute: ${description}
      Dispute Type: ${dispute_type}
      User Evidence Files: ${file_urls?.length || 0} files uploaded
      
      Platform Logs Available:
      - Transactions: ${JSON.stringify(platformEvidence.transaction_logs)}
      - Referrals: ${JSON.stringify(platformEvidence.referral_logs)}
      - UX Session Recordings (last 30 days): ${JSON.stringify(platformEvidence.ux_sessions)}
      
      Cross-reference the user's claim against:
      1. Transaction and referral platform logs
      2. UX session recordings showing actual user behavior, session quality, fraud indicators
      3. Uploaded evidence files from user
      
      Consider:
      - Do UX sessions show the user was actually present when they claim a payout failed?
      - Do fraud indicators (copy/paste, auto-fill) suggest legitimacy concerns?
      - Does conversion funnel match the earnings claim?
      - Are drop-off points consistent with the dispute narrative?
      
      Analyze this dispute and provide:
      1. Evidence assessment (is evidence sufficient?)
      2. Platform log verification (does it support the claim?)
      3. UX session correlation (does behavior align with claim?)
      4. Preliminary recommendation (approve/deny/needs_review)
      5. Reasoning for recommendation
      6. Suggested action for admin
      
      Respond in JSON format.
    `;

    const aiAnalysis = await base44.integrations.Core.InvokeLLM({
      prompt: analysisPrompt,
      model: 'gpt_5_mini',
      response_json_schema: {
        type: 'object',
        properties: {
          evidence_assessment: { type: 'string' },
          platform_verification: { type: 'string' },
          ux_session_correlation: { type: 'string' },
          recommendation: { type: 'string', enum: ['approve', 'deny', 'needs_review'] },
          reasoning: { type: 'string' },
          suggested_action: { type: 'string' },
          confidence_score: { type: 'number', minimum: 0, maximum: 100 },
        },
      },
    });

    // Create dispute record
    const dispute = await base44.asServiceRole.entities.SurveyDispute.create({
      user_id: user.id,
      dispute_type,
      description,
      evidence_file_urls: file_urls || [],
      ai_analysis: JSON.stringify(aiAnalysis),
      ai_recommendation: aiAnalysis.recommendation,
      ai_confidence: aiAnalysis.confidence_score,
      status: 'submitted_for_review',
    });

    return Response.json({
      dispute_id: dispute.id,
      ai_analysis: aiAnalysis,
      next_steps: 'Admin will review your dispute and the AI analysis within 24-48 hours',
    });
  } catch (error) {
    console.error('Dispute analysis error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});