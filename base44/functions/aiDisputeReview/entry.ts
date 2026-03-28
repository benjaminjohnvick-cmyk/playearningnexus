import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * AI-powered dispute evidence review.
 * Fetches the disputed response, runs quality guidelines check via LLM,
 * returns a structured recommendation (approve / reject / manual_review).
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { dispute_id } = await req.json();
    if (!dispute_id) return Response.json({ error: 'Missing dispute_id' }, { status: 400 });

    const disputeArr = await base44.asServiceRole.entities.SurveyDispute.filter({ id: dispute_id });
    const dispute = disputeArr[0];
    if (!dispute) return Response.json({ error: 'Dispute not found' }, { status: 404 });

    // Mark as reviewing
    await base44.asServiceRole.entities.SurveyDispute.update(dispute_id, { status: 'reviewing' });

    // Fetch related transaction & response data for evidence
    let responseData = null;
    let transactionData = null;
    let trustScore = null;

    if (dispute.transaction_id) {
      const txArr = await base44.asServiceRole.entities.PPCTransaction.filter({ id: dispute.transaction_id });
      transactionData = txArr[0] || null;
    }
    if (dispute.user_id) {
      const trustArr = await base44.asServiceRole.entities.RespondentTrustScore.filter({ user_id: dispute.user_id });
      trustScore = trustArr[0] || null;
      // Also grab recent responses
      const recentResps = await base44.asServiceRole.entities.PPCSurveyResponse.filter(
        { user_id: dispute.user_id }, '-created_date', 20
      );
      responseData = {
        total: recentResps.length,
        completed: recentResps.filter(r => r.completed).length,
        flagged: recentResps.filter(r => r.is_flagged).length,
        avg_quality: recentResps.filter(r => r.quality_score).length
          ? (recentResps.reduce((s, r) => s + (r.quality_score || 0), 0) / recentResps.filter(r => r.quality_score).length).toFixed(1)
          : 'N/A',
      };
    }

    const prompt = `You are an AI dispute resolution specialist for a survey platform. Analyze this user's appeal and recommend an action.

DISPUTE DETAILS:
- Survey/Title: ${dispute.survey_title || 'Unknown'}
- Expected amount: $${dispute.expected_amount || 'unspecified'}
- User description: "${dispute.description}"
- Screenshot provided: ${dispute.screenshot_url ? 'Yes' : 'No'}
- Transaction ID on file: ${dispute.transaction_id || 'None'}

USER HISTORY:
- Total responses: ${responseData?.total || 0}
- Completed: ${responseData?.completed || 0}
- Flagged responses: ${responseData?.flagged || 0}
- Average quality score: ${responseData?.avg_quality || 'N/A'}/100
- Trust tier: ${trustScore?.trust_tier || 'unknown'}
- Overall trust score: ${trustScore?.overall_trust_score ?? 'N/A'}/100

TRANSACTION DATA:
${transactionData ? `- Type: ${transactionData.type}, Amount: $${transactionData.amount}, Status: ${transactionData.status}` : 'No matching transaction found'}

QUALITY GUIDELINES:
- Responses completed too fast (<7s/question) are invalid
- Straight-lining (all same answers) is invalid
- Users with trust score >= 65 are generally reliable
- Screenshots/proof strongly support the user's claim
- Missing transactions with matching tx IDs should be approved

Provide a recommendation with reasoning. Be fair — high-trust users with genuine claims deserve fast approval.`;

    const aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          recommendation: { type: 'string' }, // 'approve' | 'reject' | 'manual_review'
          confidence: { type: 'number' },      // 0-100
          reasoning: { type: 'string' },
          suggested_resolution_amount: { type: 'number' },
          key_factors: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    // Auto-resolve if high confidence
    const rec = aiResult.recommendation || 'manual_review';
    const conf = aiResult.confidence || 0;
    let finalStatus = 'reviewing';
    let adminNotes = `AI Analysis (${conf}% confidence): ${aiResult.reasoning}`;

    if (rec === 'approve' && conf >= 80) {
      finalStatus = 'approved';
      adminNotes = `✅ Auto-approved by AI (${conf}% confidence). ${aiResult.reasoning}`;
    } else if (rec === 'reject' && conf >= 85) {
      finalStatus = 'rejected';
      adminNotes = `❌ Auto-rejected by AI (${conf}% confidence). ${aiResult.reasoning}`;
    }

    const resolvedAmount = rec === 'approve' ? (aiResult.suggested_resolution_amount || dispute.expected_amount || 0) : 0;

    await base44.asServiceRole.entities.SurveyDispute.update(dispute_id, {
      status: finalStatus,
      admin_notes: adminNotes,
      resolved_amount: resolvedAmount,
    });

    // Notify user
    await base44.asServiceRole.entities.Notification.create({
      user_id: dispute.user_id,
      type: finalStatus === 'approved' ? 'payout_processed' : 'status_changed',
      title: finalStatus === 'approved' ? '✅ Dispute Approved' :
             finalStatus === 'rejected' ? '❌ Dispute Rejected' : '🔍 Dispute Under AI Review',
      message: finalStatus === 'approved'
        ? `Your dispute for "${dispute.survey_title}" was approved. $${resolvedAmount.toFixed(2)} credited.`
        : finalStatus === 'rejected'
        ? `Your dispute was reviewed and could not be approved. Reason: ${aiResult.reasoning?.slice(0, 100)}`
        : 'Your dispute is being analyzed by our AI review system. You will be notified of the decision shortly.',
      status: 'unread',
      delivery_method: ['in_app'],
    });

    return Response.json({
      success: true,
      recommendation: rec,
      confidence: conf,
      final_status: finalStatus,
      resolved_amount: resolvedAmount,
      reasoning: aiResult.reasoning,
      key_factors: aiResult.key_factors || [],
    });
  } catch (error) {
    console.error('AI dispute review error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});