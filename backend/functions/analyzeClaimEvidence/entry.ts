import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { claim_id, proof_urls, claim_type, item_name, description } = await req.json();

    if (!claim_id || !proof_urls || proof_urls.length === 0) {
      return Response.json({ error: 'Missing claim_id or proof_urls' }, { status: 400 });
    }

    // Build AI prompt for evidence analysis
    const prompt = `You are a fraud detection and claim validation expert. Analyze the following claim evidence and provide an instant preliminary decision.

CLAIM DETAILS:
- Type: ${claim_type || 'survey_not_credited'}
- Item: ${item_name || 'Unknown'}
- Description: ${description || 'No description provided'}
- Evidence: ${proof_urls.length} file(s) submitted

Analyze the submitted evidence (screenshots/images) for:
1. Legitimacy: Does the evidence appear genuine (no AI-generated, no obvious fakes)?
2. Relevance: Does the evidence directly support the claim?
3. Completeness: Is there sufficient evidence to make a determination?
4. User History: Consider claim patterns (if visible in metadata).

Provide a JSON response with:
{
  "confidence_score": (0-100, where 90+ = auto-approve),
  "preliminary_decision": "approve" | "review_required" | "reject",
  "reasoning": "brief explanation",
  "auto_approve": true/false,
  "suggested_credit": (amount to credit if approved),
  "flagged_concerns": ["concern1", "concern2"] (if any)
}

Be lenient with legitimate-looking evidence. High-trust users (score 65+) deserve benefit of the doubt.`;

    const aiResult = await base44.integrations.Core.InvokeLLM({
      prompt,
      file_urls: proof_urls,
      response_json_schema: {
        type: 'object',
        properties: {
          confidence_score: { type: 'number', minimum: 0, maximum: 100 },
          preliminary_decision: { type: 'string', enum: ['approve', 'review_required', 'reject'] },
          reasoning: { type: 'string' },
          auto_approve: { type: 'boolean' },
          suggested_credit: { type: 'number' },
          flagged_concerns: { type: 'array', items: { type: 'string' } },
        },
        required: ['confidence_score', 'preliminary_decision', 'reasoning', 'auto_approve'],
      },
      model: 'gemini_3_flash', // Fast model for instant feedback
    });

    // Get claim and user trust score
    const claim = await base44.asServiceRole.entities.DisputeClaim.filter({ id: claim_id }).then(r => r[0]);
    const userTrust = await base44.asServiceRole.entities.RespondentTrustScore.filter({ user_id: claim.user_id }).then(r => r[0]);
    const trustScore = userTrust?.trust_score || 50;

    // Auto-approve if high confidence + high trust
    const shouldAutoApprove = aiResult.auto_approve && aiResult.confidence_score >= 80 && trustScore >= 60;
    const creditAmount = shouldAutoApprove ? (aiResult.suggested_credit || 0) : 0;

    // Update claim with AI analysis
    const updatedClaim = await base44.asServiceRole.entities.DisputeClaim.update(claim_id, {
      status: shouldAutoApprove ? 'approved' : aiResult.preliminary_decision === 'approve' ? 'under_review' : aiResult.preliminary_decision === 'reject' ? 'denied' : 'under_review',
      admin_notes: `✅ AI Analysis (${aiResult.confidence_score}% confidence):\n${aiResult.reasoning}\n\nUser Trust Score: ${trustScore}\n\nConcerns: ${aiResult.flagged_concerns?.join(', ') || 'None'}`,
      credit_issued: creditAmount,
      reviewed_by: 'ai_system',
      reviewed_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      claim_id,
      confidence_score: aiResult.confidence_score,
      preliminary_decision: aiResult.preliminary_decision,
      auto_approved: shouldAutoApprove,
      credit_issued: creditAmount,
      user_trust_score: trustScore,
      reasoning: aiResult.reasoning,
      concerns: aiResult.flagged_concerns || [],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});