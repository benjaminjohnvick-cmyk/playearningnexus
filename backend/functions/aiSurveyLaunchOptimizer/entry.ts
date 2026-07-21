import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * AI Survey Launch Optimizer
 * Analyzes demographic data, completion history, traffic patterns, and global timezone
 * overlaps to recommend optimal time windows for survey launches.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { survey_id, demographic_group, target_regions, survey_category, num_windows } = body;

    // Fetch historical response data for pattern analysis
    const [allResponses, allSurveys, userResponses] = await Promise.all([
      base44.asServiceRole.entities.PPCSurveyResponse.list('-created_date', 500),
      base44.asServiceRole.entities.PPCSurvey.list('-created_date', 100),
      survey_id
        ? base44.asServiceRole.entities.PPCSurveyResponse.filter({ survey_id })
        : Promise.resolve([]),
    ]);

    // Build completion-rate-by-hour histogram from historical data
    const hourBuckets = Array(24).fill(null).map(() => ({ total: 0, completed: 0 }));
    const dayBuckets = Array(7).fill(null).map(() => ({ total: 0, completed: 0 }));

    for (const r of allResponses) {
      if (!r.created_date) continue;
      const d = new Date(r.created_date);
      const hour = d.getUTCHours();
      const day = d.getUTCDay();
      hourBuckets[hour].total++;
      dayBuckets[day].total++;
      if (r.completed) {
        hourBuckets[hour].completed++;
        dayBuckets[day].completed++;
      }
    }

    const hourStats = hourBuckets.map((b, h) => ({
      hour: h,
      total: b.total,
      completion_rate: b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0,
    }));

    const dayStats = dayBuckets.map((b, d) => ({
      day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d],
      total: b.total,
      completion_rate: b.total > 0 ? Math.round((b.completed / b.total) * 100) : 0,
    }));

    // Average quality scores by hour
    const qualityByHour = Array(24).fill(null).map(() => ({ sum: 0, count: 0 }));
    for (const r of allResponses) {
      if (!r.created_date || !r.quality_score) continue;
      const hour = new Date(r.created_date).getUTCHours();
      qualityByHour[hour].sum += r.quality_score;
      qualityByHour[hour].count++;
    }
    const avgQualityByHour = qualityByHour.map((q, h) => ({
      hour: h,
      avg_quality: q.count > 0 ? Math.round(q.sum / q.count) : 0,
    }));

    // Build AI prompt with all context
    const historicalSummary = hourStats
      .sort((a, b) => b.completion_rate - a.completion_rate)
      .slice(0, 10)
      .map(s => `Hour ${s.hour}:00 UTC — ${s.completion_rate}% completion (${s.total} responses)`)
      .join('\n');

    const daySummary = dayStats
      .map(s => `${s.day}: ${s.completion_rate}% completion (${s.total} responses)`)
      .join('\n');

    const qualitySummary = avgQualityByHour
      .filter(q => q.avg_quality > 0)
      .sort((a, b) => b.avg_quality - a.avg_quality)
      .slice(0, 8)
      .map(q => `Hour ${q.hour}:00 UTC — avg quality ${q.avg_quality}/100`)
      .join('\n');

    const prompt = `You are an expert in global survey research methodology and digital engagement analytics.

A survey platform wants to maximize completion rates and data quality for a new survey launch.

SURVEY DETAILS:
- Category: ${survey_category || 'General'}
- Target demographic: ${demographic_group || 'General adult population'}
- Target regions: ${(target_regions || ['United States', 'United Kingdom', 'Canada', 'Australia']).join(', ')}
- Number of time window recommendations requested: ${num_windows || 3}

HISTORICAL PLATFORM DATA (UTC hours):
Top completion-rate hours:
${historicalSummary || 'No historical data available yet'}

Day-of-week completion rates:
${daySummary || 'No historical data available yet'}

Top data-quality hours (avg quality score):
${qualitySummary || 'No quality data available yet'}

GLOBAL TRAFFIC CONTEXT:
- US East (UTC-5): Peak digital engagement 8am–9pm local = 13:00–02:00 UTC
- US West (UTC-8): Peak 8am–9pm local = 16:00–05:00 UTC
- UK (UTC+0): Peak 8am–9pm local = 08:00–21:00 UTC
- Western Europe (UTC+1): Peak 8am–9pm local = 07:00–20:00 UTC
- Australia/Sydney (UTC+10): Peak 8am–9pm local = 22:00–11:00 UTC
- India (UTC+5:30): Peak 8am–9pm local = 02:30–15:30 UTC

DEMOGRAPHIC ENGAGEMENT PATTERNS:
- Ages 18-24: Most active evenings + late night (UTC 22:00-03:00 for US), weekend afternoons
- Ages 25-34: Active lunch breaks (12:00-13:00 local) and evenings (19:00-22:00 local)
- Ages 35-54: Morning routines (07:00-09:00 local), lunch, evening
- Ages 55+: Morning (08:00-11:00 local) and early afternoon
- Gamers: Evenings and weekends, peak 20:00-01:00 local
- Professionals: Lunch (11:30-13:30) and after work (17:30-19:30)
- Parents: Early morning (06:00-08:00) and late evening (21:00-23:00)

Based on ALL of this data, provide ${num_windows || 3} highly specific optimal launch windows with confidence scores.

Return a JSON object in this exact format:
{
  "recommended_windows": [
    {
      "rank": 1,
      "window_label": "short human-readable label",
      "utc_day": "Monday",
      "utc_start_hour": 14,
      "utc_end_hour": 17,
      "local_times_by_region": {
        "US East": "9am–12pm",
        "US West": "6am–9am",
        "UK": "2pm–5pm",
        "Europe": "3pm–6pm",
        "Australia": "12am–3am"
      },
      "estimated_completion_rate": 78,
      "estimated_quality_score": 82,
      "confidence": 91,
      "demographic_fit_score": 88,
      "reasoning": "2-3 sentence explanation of why this window is optimal",
      "traffic_overlap_score": 85,
      "best_for_regions": ["US East", "UK"],
      "potential_respondents_estimate": "high"
    }
  ],
  "summary": "2-sentence overall strategic summary",
  "avoided_windows": ["list 2-3 time windows to avoid and why"],
  "weekly_pattern_insight": "1 sentence insight about day-of-week patterns",
  "demographic_insight": "1 sentence specific insight about the target demographic"
}`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          recommended_windows: { type: 'array', items: { type: 'object' } },
          summary: { type: 'string' },
          avoided_windows: { type: 'array', items: { type: 'string' } },
          weekly_pattern_insight: { type: 'string' },
          demographic_insight: { type: 'string' },
        }
      }
    });

    return Response.json({
      success: true,
      recommendations: result,
      data_points_analyzed: allResponses.length,
      surveys_analyzed: allSurveys.length,
      hour_stats: hourStats,
      day_stats: dayStats,
    });

  } catch (error) {
    console.error('AI optimizer error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});