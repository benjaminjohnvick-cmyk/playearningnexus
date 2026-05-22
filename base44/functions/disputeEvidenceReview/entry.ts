import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { dispute_id } = body;
    if (!dispute_id) return Response.json({ error: 'dispute_id required' }, { status: 400 });

    const dispute = await base44.asServiceRole.entities.AffiliateDispute.get(dispute_id);
    if (!dispute) return Response.json({ error: 'Dispute not found' }, { status: 404 });

    // Parallel data fetch: transaction logs + social media engagement
    const [transactions, socialPosts, payouts, referrals] = await Promise.all([
      base44.asServiceRole.entities.Transaction.filter({ user_id: dispute.affiliate_user_id }, '-created_date', 50).catch(() => []),
      base44.asServiceRole.entities.SocialMediaPost.filter({ user_id: dispute.affiliate_user_id }, '-created_date', 20).catch(() => []),
      base44.asServiceRole.entities.Payout.filter({ recipient_user_id: dispute.affiliate_user_id }, '-created_date', 10).catch(() => []),
      base44.asServiceRole.entities.Referral.filter({ referrer_user_id: dispute.affiliate_user_id }, '-created_date', 20).catch(() => []),
    ]);

    // Build cross-reference context
    const txnLog = transactions.map(t =>
      `[${t.type}] $${t.amount} | ${t.status} | ${t.description || ''} | ${new Date(t.created_date).toISOString().split('T')[0]}`
    ).join('\n');

    const socialActivity = socialPosts.map(p =>
      `[${p.platform}] ${p.status} | engagement:${p.engagement || 0} | ${new Date(p.created_date).toISOString().split('T')[0]}`
    ).join('\n');

    const payoutHistory = payouts.map(p =>
      `$${p.net_payout} ${p.status} | method:${p.payout_method} | ${new Date(p.created_date).toISOString().split('T')[0]}`
    ).join('\n');

    const referralActivity = `${referrals.length} referrals on record`;

    // Specific txn match for the disputed transaction
    const matchedTxn = dispute.transaction_id
      ? transactions.find(t => t.id === dispute.transaction_id || t.description?.includes(dispute.transaction_id))
      : null;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a fraud and dispute analyst AI for GamerGain. Your job is to deeply cross-reference evidence with platform data.

DISPUTE DETAILS:
- Type: ${dispute.dispute_type}
- Amount claimed: $${dispute.amount_disputed || 0}
- Description: ${dispute.description}
- Transaction ID referenced: ${dispute.transaction_id || 'not provided'}
- Evidence files uploaded: ${(dispute.proof_urls || []).length}
- Disputed transaction found in logs: ${matchedTxn ? 'YES — ' + JSON.stringify(matchedTxn) : 'NOT FOUND'}

TRANSACTION LOG (last 50):
${txnLog || 'No transactions found'}

SOCIAL MEDIA ENGAGEMENT DATA:
${socialActivity || 'No social posts found'}

PAYOUT HISTORY:
${payoutHistory || 'No payouts found'}

REFERRAL ACTIVITY: ${referralActivity}

CROSS-REFERENCE ANALYSIS REQUIRED:
1. Does the claimed transaction appear anywhere in the logs?
2. Does the user's social media activity support the referral claim period?
3. Are there any inconsistencies between the claimed amount and typical payout ranges?
4. Are there patterns suggesting fraudulent claims (e.g., rapid multiple claims, no supporting activity)?
5. What is the probability this is a legitimate missed payment vs. already paid vs. fraud?

Generate a comprehensive fraud confidence score and moderator draft summary.

Respond as JSON:
{
  "fraud_confidence_score": 0-100 (0=definitely legitimate, 100=definitely fraud),
  "legitimacy_score": 0-100 (inverse — higher means more likely valid claim),
  "verdict": "auto_approve" | "auto_deny" | "escalate_human",
  "fraud_indicators": ["list of specific fraud signals found, or empty array"],
  "supporting_evidence": ["list of evidence points that support the claim"],
  "transaction_cross_reference": "what was found or not found in transaction logs",
  "social_engagement_correlation": "how social data relates to this claim",
  "estimated_valid_amount": number,
  "moderator_draft_summary": "2-3 paragraph professional summary for human moderators to approve/reject. Include all key findings, evidence strength, and recommendation.",
  "auto_action_taken": "description of what the system did automatically",
  "escalation_reason": "why this needs human review if verdict is escalate_human, otherwise empty string",
  "confidence_in_verdict": 0-100
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          fraud_confidence_score: { type: 'number' },
          legitimacy_score: { type: 'number' },
          verdict: { type: 'string' },
          fraud_indicators: { type: 'array', items: { type: 'string' } },
          supporting_evidence: { type: 'array', items: { type: 'string' } },
          transaction_cross_reference: { type: 'string' },
          social_engagement_correlation: { type: 'string' },
          estimated_valid_amount: { type: 'number' },
          moderator_draft_summary: { type: 'string' },
          auto_action_taken: { type: 'string' },
          escalation_reason: { type: 'string' },
          confidence_in_verdict: { type: 'number' },
        },
      },
    });

    // Determine final status
    const finalStatus =
      result.verdict === 'auto_approve' ? 'auto_approved' :
      result.verdict === 'auto_deny' ? 'denied' : 'pending_human';

    // Update dispute with full AI analysis
    await base44.asServiceRole.entities.AffiliateDispute.update(dispute_id, {
      status: finalStatus,
      ai_analysis: {
        validity_score: result.legitimacy_score,
        evidence_strength: result.legitimacy_score >= 70 ? 'strong' : result.legitimacy_score >= 40 ? 'moderate' : 'weak',
        recommended_action: result.verdict,
        analysis_notes: result.moderator_draft_summary,
        pattern_match: result.transaction_cross_reference,
      },
      admin_notes: `FRAUD SCORE: ${result.fraud_confidence_score}/100\n\nMODERATOR DRAFT:\n${result.moderator_draft_summary}\n\nFRAUD INDICATORS: ${result.fraud_indicators?.join(', ') || 'None'}\n\nSUPPORTING EVIDENCE: ${result.supporting_evidence?.join(', ') || 'None'}\n\nEXCELLATION REASON: ${result.escalation_reason}`,
      settlement_offer: result.verdict === 'auto_approve' ? {
        offered_amount: result.estimated_valid_amount,
        offer_basis: `AI auto-analysis (confidence: ${result.confidence_in_verdict}%)`,
        ai_confidence: result.confidence_in_verdict,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      } : undefined,
    });

    // Auto-pay if approved
    if (result.verdict === 'auto_approve' && result.estimated_valid_amount > 0) {
      const disputeUser = await base44.asServiceRole.entities.User.get(dispute.affiliate_user_id).catch(() => null);
      if (disputeUser) {
        await base44.asServiceRole.entities.Transaction.create({
          user_id: dispute.affiliate_user_id,
          type: 'dispute_resolution_payout',
          amount: result.estimated_valid_amount,
          description: `AI Dispute Auto-Resolution: ${dispute.dispute_type}`,
          status: 'completed',
        });
      }
    }

    return Response.json({
      success: true,
      ...result,
      final_status: finalStatus,
      dispute_id,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});