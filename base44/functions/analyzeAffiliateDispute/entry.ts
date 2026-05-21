import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { dispute_id } = await req.json();
    if (!dispute_id) return Response.json({ error: 'Missing dispute_id' }, { status: 400 });

    const disputes = await base44.asServiceRole.entities.AffiliateDispute.filter({ id: dispute_id });
    const dispute = disputes[0];
    if (!dispute) return Response.json({ error: 'Dispute not found' }, { status: 404 });

    // Fetch historical disputes for pattern matching
    const historicalDisputes = await base44.asServiceRole.entities.AffiliateDispute.filter(
      { dispute_type: dispute.dispute_type, status: 'resolved' }, '-created_date', 50
    );

    const resolvedCount = historicalDisputes.length;
    const avgSettlement = resolvedCount > 0
      ? historicalDisputes.reduce((sum, d) => sum + (d.resolved_amount || 0), 0) / resolvedCount
      : 0;
    const acceptanceRate = resolvedCount > 0
      ? historicalDisputes.filter(d => d.resolved_amount > 0).length / resolvedCount
      : 0;

    // AI analysis
    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an expert dispute resolution AI for an affiliate marketing platform.

DISPUTE DETAILS:
- Type: ${dispute.dispute_type}
- Amount Disputed: $${dispute.amount_disputed || 0}
- Description: ${dispute.description}
- Proof provided: ${(dispute.proof_urls || []).length} files uploaded

HISTORICAL PATTERNS (${resolvedCount} similar resolved cases):
- Average settlement: $${avgSettlement.toFixed(2)}
- Historical acceptance rate: ${(acceptanceRate * 100).toFixed(0)}%

Analyze this dispute and provide:
1. A validity score (0-100)
2. Evidence strength assessment
3. Recommended action
4. Settlement offer amount based on historical data
5. Confidence in the settlement offer (0-100)

Return JSON only.`,
      response_json_schema: {
        type: 'object',
        properties: {
          validity_score: { type: 'number' },
          evidence_strength: { type: 'string' },
          pattern_match: { type: 'string' },
          recommended_action: { type: 'string' },
          analysis_notes: { type: 'string' },
          settlement_amount: { type: 'number' },
          settlement_basis: { type: 'string' },
          confidence: { type: 'number' }
        }
      }
    });

    const settlementExpiry = new Date();
    settlementExpiry.setDate(settlementExpiry.getDate() + 7);

    const updatedTimeline = [
      ...(dispute.timeline || []),
      { event: 'AI Analysis Complete', timestamp: new Date().toISOString(), actor: 'AI System', note: analysis.analysis_notes }
    ];

    if (analysis.settlement_amount > 0) {
      updatedTimeline.push({
        event: 'Settlement Offer Generated',
        timestamp: new Date().toISOString(),
        actor: 'AI System',
        note: `Offer: $${analysis.settlement_amount} - ${analysis.settlement_basis}`
      });
    }

    await base44.asServiceRole.entities.AffiliateDispute.update(dispute_id, {
      status: analysis.settlement_amount > 0 ? 'settlement_offered' : 'ai_analyzed',
      ai_analysis: {
        validity_score: analysis.validity_score,
        pattern_match: analysis.pattern_match,
        evidence_strength: analysis.evidence_strength,
        recommended_action: analysis.recommended_action,
        similar_cases: resolvedCount,
        analysis_notes: analysis.analysis_notes
      },
      settlement_offer: analysis.settlement_amount > 0 ? {
        offered_amount: analysis.settlement_amount,
        offer_basis: analysis.settlement_basis,
        expires_at: settlementExpiry.toISOString(),
        ai_confidence: analysis.confidence
      } : dispute.settlement_offer,
      timeline: updatedTimeline
    });

    // Notify affiliate
    if (dispute.affiliate_email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: dispute.affiliate_email,
        from_name: 'GamerGain Dispute Center',
        subject: `🔍 Dispute #${dispute_id.slice(-6).toUpperCase()} — AI Analysis Complete`,
        body: `Hi,\n\nYour dispute has been analyzed by our AI system.\n\nValidity Score: ${analysis.validity_score}/100\nEvidence Strength: ${analysis.evidence_strength}\n\n${analysis.settlement_amount > 0 ? `💰 Settlement Offer: $${analysis.settlement_amount}\nBasis: ${analysis.settlement_basis}\nExpires: ${settlementExpiry.toDateString()}\n\n` : ''}${analysis.analysis_notes}\n\nView your dispute: https://gamergain.app/AffiliateDisputeCenter\n\n— GamerGain Support`
      }).catch(() => null);
    }

    return Response.json({
      success: true,
      dispute_id,
      validity_score: analysis.validity_score,
      evidence_strength: analysis.evidence_strength,
      settlement_offered: analysis.settlement_amount > 0,
      settlement_amount: analysis.settlement_amount,
      confidence: analysis.confidence
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});