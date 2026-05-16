import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Get low-confidence disputes (clear-cut cases)
    const disputes = await base44.asServiceRole.entities.SurveyDispute.filter({
      status: 'pending',
      severity: 'low'
    }, '-created_date', 10);

    const resolutions = [];

    for (const dispute of disputes) {
      // Score dispute based on evidence & respondent history
      const respondent = await base44.asServiceRole.entities.User.get(dispute.respondent_id);
      const trustScore = respondent.trust_score || 50;
      const trustLevel = trustScore > 80 ? 'high' : trustScore > 60 ? 'medium' : 'low';

      // Auto-resolve clear cases
      if (trustLevel === 'high' && dispute.severity === 'low') {
        // Refund user
        await base44.asServiceRole.entities.SurveyDispute.update(dispute.id, {
          status: 'approved',
          resolution: 'auto_refund_low_severity_high_trust',
          resolved_at: new Date().toISOString()
        });

        // Process payout
        await base44.functions.invoke('processRewardPayout', {
          user_id: dispute.claimant_id,
          amount: dispute.claim_amount,
          reason: 'dispute_resolution'
        });

        resolutions.push({
          dispute_id: dispute.id,
          resolution: 'approved',
          amount: dispute.claim_amount
        });
      }
    }

    return Response.json({ success: true, resolved: resolutions.length, resolutions });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});