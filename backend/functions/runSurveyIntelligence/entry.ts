import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Backend function: analyze all survey data and auto-apply improvements
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { trigger = 'manual' } = await req.json().catch(() => ({}));

    // 1. Fetch all data needed for analysis
    const [feedbackResponses, ppcResponses, disputes, surveys, feedbackSurveys] = await Promise.all([
      base44.asServiceRole.entities.FeedbackSurveyResponse.list('-created_date', 200),
      base44.asServiceRole.entities.PPCSurveyResponse.list('-created_date', 500),
      base44.asServiceRole.entities.SurveyDispute.list('-created_date', 100),
      base44.asServiceRole.entities.PPCSurvey.list('-created_date', 50),
      base44.asServiceRole.entities.DailyFeedbackSurvey.filter({ status: 'active' }, '-created_date', 5),
    ]);

    // 2. Calculate category scores from feedback responses
    const categoryScores = {};
    const categoryCount = {};
    for (const response of feedbackResponses) {
      for (const answer of (response.answers || [])) {
        if (answer.category && answer.rating) {
          if (!categoryScores[answer.category]) { categoryScores[answer.category] = 0; categoryCount[answer.category] = 0; }
          categoryScores[answer.category] += answer.rating;
          categoryCount[answer.category]++;
        }
      }
    }
    const avgCategoryScores = {};
    for (const cat of Object.keys(categoryScores)) {
      avgCategoryScores[cat] = Math.round((categoryScores[cat] / categoryCount[cat]) * 10) / 10;
    }

    // 3. Find low-performing surveys (completion < 40%)
    const lowPerfSurveys = surveys.filter(s => {
      const total = (s.responses_count || 0);
      const completionRate = total > 10 ? (total / (s.max_responses || 50)) * 100 : 100;
      return completionRate < 40 && s.status === 'active';
    });

    // 4. Analyze disputes
    const disputeReasons = {};
    for (const d of disputes) {
      const key = d.appeal_reason || 'other';
      disputeReasons[key] = (disputeReasons[key] || 0) + 1;
    }

    // 5. Build summary data for LLM analysis
    const analysisData = {
      total_feedback_responses: feedbackResponses.length,
      total_ppc_responses: ppcResponses.length,
      total_disputes: disputes.length,
      category_scores: avgCategoryScores,
      low_scoring_categories: Object.entries(avgCategoryScores).filter(([, v]) => v < 6).map(([k]) => k),
      top_dispute_reasons: Object.entries(disputeReasons).sort((a, b) => b[1] - a[1]).slice(0, 5),
      low_performing_survey_count: lowPerfSurveys.length,
      dismissed_without_completing: feedbackResponses.filter(r => r.dismissed_without_completing).length,
    };

    // 6. Use LLM to generate deep insights and recommendations
    const analysis = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are GamerGain's Survey Intelligence AI. Analyze this platform survey data and produce a comprehensive analysis.

DATA SUMMARY:
${JSON.stringify(analysisData, null, 2)}

SAMPLE RECENT FEEDBACK (last 10):
${JSON.stringify(feedbackResponses.slice(0, 10).map(r => ({ answers: r.answers?.slice(0, 3), dismissed: r.dismissed_without_completing })), null, 2)}

DISPUTE SAMPLE:
${JSON.stringify(disputes.slice(0, 5).map(d => ({ type: d.dispute_type, reason: d.appeal_reason, description: d.description?.slice(0, 100) })), null, 2)}

Generate:
1. 5-8 specific key_insights (data-driven findings referencing actual numbers)
2. sentiment_summary (2-3 sentences on overall platform health)
3. 4-6 recommended_changes for admin review, each with: title, description, rationale (cite data), priority (critical/high/medium/low), affected_area, implementation_notes, status="pending_review"
4. direct_modifications: list of specific survey question improvements for low-performing areas

Be specific. Reference actual percentages and counts from the data.`,
      response_json_schema: {
        type: "object",
        properties: {
          key_insights: { type: "array", items: { type: "string" } },
          sentiment_summary: { type: "string" },
          recommended_changes: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                description: { type: "string" },
                rationale: { type: "string" },
                priority: { type: "string" },
                affected_area: { type: "string" },
                implementation_notes: { type: "string" },
                status: { type: "string" }
              }
            }
          },
          direct_modifications: {
            type: "array",
            items: {
              type: "object",
              properties: {
                area: { type: "string" },
                change: { type: "string" },
                reason: { type: "string" }
              }
            }
          }
        }
      }
    });

    // 7. Auto-update active DailyFeedbackSurvey to focus on low-scoring areas
    let autoUpdatedSurveys = 0;
    if (feedbackSurveys.length > 0 && analysisData.low_scoring_categories.length > 0) {
      const activeSurvey = feedbackSurveys[0];
      const lowAreas = analysisData.low_scoring_categories.slice(0, 3);
      await base44.asServiceRole.entities.DailyFeedbackSurvey.update(activeSurvey.id, {
        focus_areas: lowAreas,
      });
      autoUpdatedSurveys++;
    }

    // 8. Save the analysis record
    const today = new Date().toISOString().split('T')[0];
    const analysisRecord = await base44.asServiceRole.entities.AIFeedbackAnalysis.create({
      survey_id: feedbackSurveys[0]?.id || 'manual',
      survey_date: today,
      total_responses_analyzed: feedbackResponses.length + ppcResponses.length,
      key_insights: analysis.key_insights || [],
      category_scores: avgCategoryScores,
      sentiment_summary: analysis.sentiment_summary || '',
      recommended_changes: (analysis.recommended_changes || []).map(c => ({
        ...c,
        id: crypto.randomUUID(),
        status: 'pending_review'
      })),
      status: 'completed',
      run_at: new Date().toISOString(),
    });

    return Response.json({
      success: true,
      analysis_id: analysisRecord.id,
      stats: {
        responses_analyzed: feedbackResponses.length + ppcResponses.length,
        insights_generated: analysis.key_insights?.length || 0,
        recommendations: analysis.recommended_changes?.length || 0,
        direct_modifications: analysis.direct_modifications?.length || 0,
        surveys_auto_updated: autoUpdatedSurveys,
        low_performing_surveys_flagged: lowPerfSurveys.length,
      },
      direct_modifications: analysis.direct_modifications || [],
      sentiment_summary: analysis.sentiment_summary,
    });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});