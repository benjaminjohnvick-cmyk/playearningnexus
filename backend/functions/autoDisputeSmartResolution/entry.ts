import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch open disputes awaiting resolution
    const disputes = await base44.entities.DisputeClaim.filter({
      status: 'open'
    }, '-created_date', 50);

    let resolutionsGenerated = 0;
    const resolutions = [];

    for (const dispute of disputes) {
      try {
        // Get dispute context
        const claimDetails = {
          type: dispute.claim_type,
          description: dispute.description,
          evidence_count: dispute.evidence_items?.length || 0,
          amount: dispute.claimed_amount,
          days_open: Math.floor((new Date() - new Date(dispute.created_date)) / (1000 * 60 * 60 * 24))
        };

        // Use AI to analyze and recommend resolution
        const resolutionAnalysis = await base44.integrations.Core.InvokeLLM({
          prompt: `Analyze this dispute and recommend fair resolution.

Dispute Details:
- Type: ${claimDetails.type}
- Description: ${claimDetails.description}
- Claimed Amount: $${claimDetails.amount}
- Evidence Pieces: ${claimDetails.evidence_count}
- Days Open: ${claimDetails.days_open}

Return JSON with:
1. recommended_action: "approve", "partially_approve", "deny"
2. recommended_payout: amount to pay
3. reasoning: brief explanation
4. precedent_similar_cases: count of similar cases
5. confidence: 0-100
6. escalate_to_human: boolean (high-value or complex cases)`,
          response_json_schema: {
            type: 'object',
            properties: {
              recommended_action: { type: 'string' },
              recommended_payout: { type: 'number' },
              reasoning: { type: 'string' },
              precedent_similar_cases: { type: 'number' },
              confidence: { type: 'number' },
              escalate_to_human: { type: 'boolean' }
            }
          }
        });

        // Auto-resolve if high confidence and low amount
        if (!resolutionAnalysis.escalate_to_human && 
            resolutionAnalysis.confidence >= 85 && 
            claimDetails.amount <= 500) {
          // Auto-process resolution
          await base44.entities.DisputeClaim.update(dispute.id, {
            status: resolutionAnalysis.recommended_action === 'approve' ? 'approved' : 
                   resolutionAnalysis.recommended_action === 'partially_approve' ? 'approved_partial' : 'denied',
            resolution_notes: resolutionAnalysis.reasoning,
            ai_recommended_payout: resolutionAnalysis.recommended_payout
          });
          resolutionsGenerated++;
        }

        resolutions.push({
          dispute_id: dispute.id,
          claim_type: dispute.claim_type,
          amount: claimDetails.amount,
          recommended_action: resolutionAnalysis.recommended_action,
          recommended_payout: resolutionAnalysis.recommended_payout,
          confidence: resolutionAnalysis.confidence,
          auto_resolved: !resolutionAnalysis.escalate_to_human && resolutionAnalysis.confidence >= 85,
          escalated: resolutionAnalysis.escalate_to_human,
          awaiting_review: resolutionAnalysis.confidence >= 70 && resolutionAnalysis.confidence < 85
        });
      } catch (error) {
        console.error(`Resolution analysis failed:`, error);
      }
    }

    return Response.json({
      disputes_analyzed: disputes.length,
      auto_resolved: resolutionsGenerated,
      escalated_to_human: resolutions.filter(r => r.escalated).length,
      awaiting_review: resolutions.filter(r => r.awaiting_review).length,
      results: resolutions
    });
  } catch (error) {
    console.error('Dispute resolution error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});