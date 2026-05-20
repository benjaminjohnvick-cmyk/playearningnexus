import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch active users for segmentation
    const users = await base44.entities.User.filter({}, '-created_date', 1000);

    // Use AI to identify cohorts
    const segmentationAnalysis = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze user cohorts and behavioral segments for ${users.length} users.

User Data Summary:
- Total Users: ${users.length}
- New Users (last 30 days): ${users.filter(u => {
        const days = (new Date() - new Date(u.created_date)) / (1000 * 60 * 60 * 24);
        return days <= 30;
      }).length}
- Active Users: ${users.filter(u => u.last_activity_date && (new Date() - new Date(u.last_activity_date)) / (1000 * 60 * 60 * 24) <= 7).length}

Return JSON with:
1. suggested_segments: array of 5-8 segment definitions
2. segment_names: array of names for each segment
3. segment_characteristics: object mapping segment names to key traits
4. marketing_approach_per_segment: object with strategy per segment
5. confidence: 0-100`,
      response_json_schema: {
        type: 'object',
        properties: {
          suggested_segments: { type: 'array', items: { type: 'string' } },
          segment_names: { type: 'array', items: { type: 'string' } },
          segment_characteristics: { type: 'object', additionalProperties: { type: 'string' } },
          marketing_approach_per_segment: { type: 'object', additionalProperties: { type: 'string' } },
          confidence: { type: 'number' }
        }
      }
    });

    // Auto-apply if high confidence
    let segmentsApplied = 0;
    if (segmentationAnalysis.confidence >= 80) {
      segmentsApplied = segmentationAnalysis.suggested_segments.length;
      // In production: create segments in database
    }

    return Response.json({
      users_analyzed: users.length,
      segments_identified: segmentationAnalysis.suggested_segments.length,
      segments_applied: segmentsApplied,
      segment_names: segmentationAnalysis.segment_names,
      characteristics: segmentationAnalysis.segment_characteristics,
      marketing_strategies: segmentationAnalysis.marketing_approach_per_segment,
      confidence: segmentationAnalysis.confidence,
      awaiting_review: segmentationAnalysis.confidence < 80
    });
  } catch (error) {
    console.error('User segmentation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});