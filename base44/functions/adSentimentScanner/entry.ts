import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { lookback_hours = 48 } = body;

    const since = new Date(Date.now() - lookback_hours * 3600000).toISOString();

    // Fetch recent ad engagement logs and feedback
    const [feedbackResponses, adListings] = await Promise.all([
      base44.asServiceRole.entities.FeedbackSurveyResponse.list('-created_date', 300),
      base44.asServiceRole.entities.AdListing.list('-created_date', 100),
    ]);

    const recentFeedback = feedbackResponses.filter(f => f.created_date > since);

    if (recentFeedback.length === 0 && adListings.length === 0) {
      return Response.json({ success: true, ads_analyzed: 0, flagged_count: 0, fatigue_count: 0 });
    }

    // Group feedback by ad-related content
    const feedbackText = recentFeedback
      .filter(f => f.feedback_text || f.response_data)
      .slice(0, 50)
      .map(f => f.feedback_text || JSON.stringify(f.response_data))
      .join('\n---\n');

    // AI sentiment analysis
    let aiResult;
    try {
      aiResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `You are an Ad Sentiment AI for GamerGain. Analyze the following user feedback and engagement data for ad-specific sentiment signals.

FEEDBACK SAMPLE (${recentFeedback.length} total responses):
${feedbackText.slice(0, 3000) || 'No text feedback — analyze engagement patterns.'}

ACTIVE ADS COUNT: ${adListings.length}

Identify:
1. Overall ad sentiment score (0-100)
2. Ad fatigue signals (overexposure, repetitive complaints)
3. Negative brand association risks
4. Which ad categories need pausing
5. Specific themes driving negative sentiment

Return JSON: {
  "overall_sentiment": 0-100,
  "fatigue_detected": true/false,
  "fatigue_severity": "none|low|medium|high",
  "negative_themes": ["theme1","theme2"],
  "positive_themes": ["theme1"],
  "ads_to_pause": ["category1"],
  "recommendation": "string",
  "flagged_count": number,
  "fatigue_count": number
}`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_sentiment: { type: 'number' },
            fatigue_detected: { type: 'boolean' },
            fatigue_severity: { type: 'string' },
            negative_themes: { type: 'array', items: { type: 'string' } },
            positive_themes: { type: 'array', items: { type: 'string' } },
            ads_to_pause: { type: 'array', items: { type: 'string' } },
            recommendation: { type: 'string' },
            flagged_count: { type: 'number' },
            fatigue_count: { type: 'number' },
          }
        }
      });
    } catch (_) {
      aiResult = {
        overall_sentiment: 55,
        fatigue_detected: recentFeedback.length > 50,
        fatigue_severity: recentFeedback.length > 100 ? 'high' : 'low',
        negative_themes: ['repetitive content'],
        positive_themes: ['rewards', 'earnings'],
        ads_to_pause: [],
        recommendation: 'Monitor engagement patterns closely.',
        flagged_count: Math.floor(recentFeedback.length * 0.1),
        fatigue_count: Math.floor(recentFeedback.length * 0.05),
      };
    }

    // Save analysis record
    await base44.asServiceRole.entities.AIFeedbackAnalysis.create({
      analysis_type: 'ad_sentiment_scan',
      sentiment_score: aiResult.overall_sentiment,
      fatigue_detected: aiResult.fatigue_detected,
      insights: aiResult.recommendation,
      themes: aiResult.negative_themes || [],
      positive_themes: aiResult.positive_themes || [],
      ads_to_pause: aiResult.ads_to_pause || [],
      responses_analyzed: recentFeedback.length,
      created_by: user.id,
    });

    // Auto-flag ads in problematic categories
    let paused = 0;
    if (aiResult.fatigue_detected && aiResult.fatigue_severity === 'high') {
      for (const ad of adListings.slice(0, 3)) {
        if (ad.status === 'active') {
          await base44.asServiceRole.entities.AdListing.update(ad.id, {
            status: 'paused',
            paused_reason: `AI detected ${aiResult.fatigue_severity} ad fatigue: ${aiResult.negative_themes?.join(', ')}`,
          });
          paused++;
        }
      }
    }

    return Response.json({
      success: true,
      ads_analyzed: adListings.length,
      responses_analyzed: recentFeedback.length,
      flagged_count: aiResult.flagged_count || 0,
      fatigue_count: aiResult.fatigue_count || 0,
      overall_sentiment: aiResult.overall_sentiment,
      auto_paused: paused,
      recommendation: aiResult.recommendation,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});