import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { survey_id } = await req.json();

    if (!survey_id) {
      return Response.json({ error: 'Missing survey_id' }, { status: 400 });
    }

    // Get survey details
    const survey = await base44.asServiceRole.entities.PPCSurvey.filter({
      id: survey_id
    });

    if (!survey || survey.length === 0) {
      return Response.json({ error: 'Survey not found' }, { status: 404 });
    }

    const surveyData = survey[0];
    
    // Get associated website analytics
    const analytics = await base44.asServiceRole.entities.ProductWebsiteAnalytics.filter({
      survey_id: survey_id
    });

    const analyticsData = analytics[0] || {
      total_visits: 0,
      daily_visits: [],
      referrer_breakdown: {}
    };

    // Get survey responses
    const responses = await base44.asServiceRole.entities.PPCSurveyResponse.filter({
      survey_id: survey_id
    });

    const responseCount = responses.length;
    const conversionRate = analyticsData.total_visits > 0 
      ? ((responseCount / analyticsData.total_visits) * 100).toFixed(2)
      : 0;

    // AI-generate insights
    const prompt = `Generate a comprehensive product analytics report for:

Survey Title: ${surveyData.title || 'Product Survey'}
Product: ${analyticsData.product_name || 'Unknown Product'}
Website: ${analyticsData.product_url || 'N/A'}

Key Metrics:
- Total Website Visits: ${analyticsData.total_visits}
- Survey Responses: ${responseCount}
- Conversion Rate: ${conversionRate}%
- Top Referrer: ${Object.entries(analyticsData.referrer_breakdown || {}).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A'}

Provide a structured JSON report with:
1. Executive Summary (2 sentences)
2. Key Findings (3 bullet points)
3. Audience Insights (3 bullet points)
4. Recommendations (3 actionable items)
5. Next Steps (2 suggestions)

Format as JSON.`;

    const aiReport = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          executive_summary: { type: 'string' },
          key_findings: { type: 'array', items: { type: 'string' } },
          audience_insights: { type: 'array', items: { type: 'string' } },
          recommendations: { type: 'array', items: { type: 'string' } },
          next_steps: { type: 'array', items: { type: 'string' } }
        }
      }
    });

    // Store report
    const report = await base44.asServiceRole.entities.ProductAnalyticsReport.create({
      survey_id: survey_id,
      product_url: analyticsData.product_url,
      creator_id: user.id,
      total_visits: analyticsData.total_visits,
      survey_responses: responseCount,
      conversion_rate: parseFloat(conversionRate),
      ai_insights: aiReport,
      referrer_breakdown: analyticsData.referrer_breakdown,
      daily_visits: analyticsData.daily_visits,
      generated_at: new Date().toISOString()
    });

    // Send to business creator
    const creator = await base44.asServiceRole.entities.User.filter({ id: surveyData.creator_id });
    if (creator && creator[0]?.email) {
      await base44.integrations.Core.SendEmail({
        to: creator[0].email,
        subject: `📊 Product Analytics Report - ${surveyData.title}`,
        body: `Your product survey has been analyzed!\n\nWebsite Visits: ${analyticsData.total_visits}\nSurvey Responses: ${responseCount}\nConversion Rate: ${conversionRate}%\n\nExecutive Summary:\n${aiReport.executive_summary}\n\nKey Findings:\n${aiReport.key_findings?.map(f => `• ${f}`).join('\n')}\n\nRecommendations:\n${aiReport.recommendations?.map(r => `• ${r}`).join('\n')}`
      });
    }

    return Response.json({
      success: true,
      report_id: report.id,
      metrics: {
        total_visits: analyticsData.total_visits,
        survey_responses: responseCount,
        conversion_rate: conversionRate,
        referrers: analyticsData.referrer_breakdown
      },
      ai_insights: aiReport
    });
  } catch (error) {
    console.error('Analytics report generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});