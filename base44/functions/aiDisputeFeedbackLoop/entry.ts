import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch recently resolved disputes with admin overrides
    const resolvedClaims = await base44.entities.DisputeClaim.filter({
      status: 'resolved',
      admin_override: true
    }, '-resolved_date', 100);

    if (resolvedClaims.length === 0) {
      return Response.json({ message: 'No overrides to process', processed: 0 });
    }

    // Analyze patterns in admin overrides
    const patterns = {
      acceptedMoreThanAI: 0,
      rejectedMoreThanAI: 0,
      payoutAdjustments: [],
      commonRejectReasons: {},
      avgAIConfidence: 0,
      totalProcessed: 0
    };

    let totalConfidence = 0;

    resolvedClaims.forEach(claim => {
      patterns.totalProcessed++;
      totalConfidence += claim.ai_resolution_score || 0;

      // Track payout adjustments
      if (claim.final_payout !== claim.recommended_payout) {
        const diff = claim.final_payout - claim.recommended_payout;
        patterns.payoutAdjustments.push({
          claimId: claim.id,
          aiRecommended: claim.recommended_payout,
          adminDecided: claim.final_payout,
          difference: diff,
          percentChange: ((diff / (claim.recommended_payout || 1)) * 100).toFixed(2)
        });
      }

      // Track override decisions
      if (claim.final_decision === 'rejected' && claim.ai_recommendation?.includes('approve')) {
        patterns.rejectedMoreThanAI++;
        if (claim.admin_notes) {
          patterns.commonRejectReasons[claim.admin_notes] = 
            (patterns.commonRejectReasons[claim.admin_notes] || 0) + 1;
        }
      } else if (claim.final_decision === 'approved' && claim.ai_recommendation?.includes('reject')) {
        patterns.acceptedMoreThanAI++;
      }
    });

    patterns.avgAIConfidence = (totalConfidence / patterns.totalProcessed).toFixed(2);

    // Generate improvement recommendations using AI
    const improvementPrompt = `
    You are analyzing human admin overrides of AI dispute resolution decisions to improve the AI system.
    
    Analysis Data:
    - Total claims analyzed: ${patterns.totalProcessed}
    - Admin rejected more than AI recommended: ${patterns.rejectedMoreThanAI} cases
    - Admin approved more than AI recommended: ${patterns.acceptedMoreThanAI} cases
    - Average AI confidence score: ${patterns.avgAIConfidence}%
    - Payout adjustment patterns: ${JSON.stringify(patterns.payoutAdjustments.slice(0, 5))}
    - Common rejection reasons: ${JSON.stringify(patterns.commonRejectReasons)}
    
    Based on these patterns, provide 3-5 specific improvements the AI should make to its dispute resolution accuracy.
    Format as JSON: { improvements: [{ area: string, suggestion: string, priority: 'high'|'medium'|'low' }] }
    `;

    const aiAnalysis = await base44.integrations.Core.InvokeLLM({
      prompt: improvementPrompt,
      response_json_schema: {
        type: 'object',
        properties: {
          improvements: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                area: { type: 'string' },
                suggestion: { type: 'string' },
                priority: { type: 'string', enum: ['high', 'medium', 'low'] }
              }
            }
          }
        }
      }
    });

    // Store feedback analysis for self-improvement engine
    await base44.asServiceRole.entities.AutomationReview.create({
      automation_name: 'aiDisputeResolver Feedback Loop',
      automation_type: 'dispute_resolution',
      entity_id: 'dispute_feedback',
      entity_type: 'DisputeClaim',
      ai_recommendation: {
        analysisDate: new Date().toISOString(),
        patterns,
        improvements: aiAnalysis.improvements
      },
      ai_confidence: parseInt(patterns.avgAIConfidence),
      priority: patterns.rejectedMoreThanAI > patterns.acceptedMoreThanAI ? 'high' : 'medium',
      status: 'pending',
      human_notes: 'AI-generated improvement suggestions from override feedback'
    });

    // Log this feedback for the self-improvement engine
    await base44.asServiceRole.functions.invoke('aiAgentSelfImprovementEngine', {
      agentName: 'aiDisputeResolver',
      feedbackType: 'admin_overrides',
      analysisResults: {
        totalOverrides: patterns.totalProcessed,
        patterns,
        improvements: aiAnalysis.improvements
      }
    });

    return Response.json({
      success: true,
      processed: patterns.totalProcessed,
      patterns,
      improvements: aiAnalysis.improvements,
      feedbackLogged: true
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});