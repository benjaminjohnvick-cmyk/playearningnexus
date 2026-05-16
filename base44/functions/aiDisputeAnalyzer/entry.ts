import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
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
    let platformEvidence = { transaction_logs: [], referral_logs: [] };

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

    // Use AI to analyze evidence
    const analysisPrompt = `
      User Dispute: ${description}
      Dispute Type: ${dispute_type}
      User Evidence Files: ${file_urls?.length || 0} files uploaded
      
      Platform Logs Available:
      - Transactions: ${JSON.stringify(platformEvidence.transaction_logs)}
      - Referrals: ${JSON.stringify(platformEvidence.referral_logs)}
      
      Analyze this dispute and provide:
      1. Evidence assessment (is evidence sufficient?)
      2. Platform log verification (does it support the claim?)
      3. Preliminary recommendation (approve/deny/needs_review)
      4. Reasoning for recommendation
      5. Suggested action for admin
      
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