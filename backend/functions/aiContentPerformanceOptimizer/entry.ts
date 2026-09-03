import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
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
      
      // Real engagement from the posted item's stored metrics (never a random number). Metrics may live on the
      // item or in content_data; when nothing has been measured yet, report null rather than a fabricated score.
      const m = { ...(item || {}), ...(content || {}) };
      const likes = Number(m.likes ?? m.like_count ?? 0);
      const shares = Number(m.shares ?? m.share_count ?? 0);
      const comments = Number(m.comments ?? m.comment_count ?? 0);
      const clicks = Number(m.clicks ?? m.click_count ?? 0);
      const impressions = Number(m.impressions ?? m.reach ?? 0);
      const interactions = likes + shares * 2 + comments * 2 + clicks * 3;
      const measured = impressions > 0 || interactions > 0;
      const engagement_score = !measured
        ? null
        : impressions > 0
          ? Math.min(100, Math.round((interactions / impressions) * 1000) / 10)  // engagement rate (%), capped at 100
          : Math.min(100, interactions);                                          // raw interaction count when no impressions

      const engagement = {
        platform: content.platform,
        type: content.type,
        engagement_score,               // real, or null when not yet measured — no placeholder
        engagement_measured: measured,
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