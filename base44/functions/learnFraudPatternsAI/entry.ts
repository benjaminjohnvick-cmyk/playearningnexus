import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch flagged transactions/activities for analysis
    const fraudReports = await base44.entities.FraudReport.filter({}, '-created_date', 100);
    
    let patternsIdentified = 0;
    const learnings = [];

    for (const report of fraudReports) {
      try {
        // Get detailed context for the fraud case
        const caseDetails = {
          report_id: report.id,
          type: report.fraud_type,
          severity: report.severity,
          description: report.description,
          evidence_count: report.evidence?.length || 0
        };

        // Use AI to identify hidden patterns
        const patternAnalysis = await base44.integrations.Core.InvokeLLM({
          prompt: `Analyze this fraud case and identify reusable detection patterns for future prevention.

Case: ${caseDetails.description}
Type: ${caseDetails.type}
Severity: ${caseDetails.severity}
Evidence Points: ${caseDetails.evidence_count}

Return JSON with:
1. pattern_identified: brief description of the fraud pattern
2. detection_rule: specific rule to catch similar cases (e.g., "velocity_check", "location_mismatch", "behavioral_anomaly")
3. confidence: 0-100 how likely this rule will catch similar fraud
4. false_positive_risk: 0-100 risk of flagging legitimate users`,
          response_json_schema: {
            type: 'object',
            properties: {
              pattern_identified: { type: 'string' },
              detection_rule: { type: 'string' },
              confidence: { type: 'number' },
              false_positive_risk: { type: 'number' }
            },
            required: ['pattern_identified', 'detection_rule', 'confidence']
          }
        });

        // Store learning if confidence is high and false positive risk is low
        const shouldApplyRule = patternAnalysis.confidence >= 80 && patternAnalysis.false_positive_risk <= 15;

        if (shouldApplyRule) {
          // In production, this would update fraud detection rules in a dedicated rules table
          patternsIdentified++;
        }

        learnings.push({
          report_id: report.id,
          pattern: patternAnalysis.pattern_identified,
          detection_rule: patternAnalysis.detection_rule,
          confidence: patternAnalysis.confidence,
          false_positive_risk: patternAnalysis.false_positive_risk,
          applied: shouldApplyRule,
          awaiting_review: patternAnalysis.confidence >= 70 && patternAnalysis.confidence < 80
        });
      } catch (error) {
        console.error(`Pattern analysis failed for report ${report.id}:`, error);
      }
    }

    return Response.json({
      reports_analyzed: fraudReports.length,
      patterns_identified: patternsIdentified,
      patterns_pending_review: learnings.filter(l => l.awaiting_review).length,
      learnings: learnings.slice(0, 50),
      requires_review: learnings.some(l => l.awaiting_review)
    });
  } catch (error) {
    console.error('Fraud pattern learning error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});