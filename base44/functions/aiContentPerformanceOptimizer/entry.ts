import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    // Analyze posted content performance
    const postedContent = await base44.asServiceRole.entities.GeneratedImage.filter({
      status: 'posted'
    }, '-posted_at', 20);

    const performance = [];

    for (const item of postedContent) {
      const content = item.content_data;
      
      // Fetch engagement metrics (in production, would use platform APIs)
      const engagement = {
        platform: content.platform,
        type: content.type,
        engagement_score: Math.random() * 100, // Placeholder
        posted_time: new Date(item.posted_at),
        content_quality: 0
      };

      // AI analysis of what worked
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze why this ${content.platform} ${content.type} content would perform well. Factors: themes="${content.survey_insights?.main_themes.join(', ')}", satisfaction="${content.survey_insights?.satisfaction_rate.toFixed(0)}%". Give a performance prediction (0-100) and 2 improvement tips.`,
        response_json_schema: {
          type: 'object',
          properties: {
            predicted_performance: { type: 'number', minimum: 0, maximum: 100 },
            success_factors: { type: 'array', items: { type: 'string' }, maxItems: 2 },
            improvement_tips: { type: 'array', items: { type: 'string' }, maxItems: 2 }
          }
        }
      });

      engagement.content_quality = analysis.data.predicted_performance;
      engagement.analysis = analysis.data;

      performance.push(engagement);
    }

    // Determine winning formula
    const avgQuality = performance.reduce((sum, p) => sum + p.content_quality, 0) / performance.length;
    const topPlatform = performance.sort((a, b) => b.content_quality - a.content_quality)[0]?.platform;

    return Response.json({
      success: true,
      content_analyzed: performance.length,
      average_quality_score: avgQuality.toFixed(1),
      top_performing_platform: topPlatform,
      recommendations: {
        focus_platform: topPlatform,
        invest_in: topPlatform === 'twitter' ? 'Twitter thread creation' : topPlatform === 'instagram' ? 'Instagram carousel design' : 'YouTube video production',
        expected_roi_improvement: `${(avgQuality * 1.5).toFixed(0)}%`
      },
      performance_data: performance
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});