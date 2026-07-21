import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Scheduled function: runs each evening, finds today's survey and triggers AI analysis
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const today = new Date().toISOString().split('T')[0];
    const surveys = await base44.asServiceRole.entities.DailyFeedbackSurvey.filter({ date: today, status: 'active' });

    if (!surveys.length) {
      return Response.json({ message: 'No active survey for today' });
    }

    const survey = surveys[0];

    // Check if analysis already ran today
    const existingAnalyses = await base44.asServiceRole.entities.AIFeedbackAnalysis.filter({
      survey_id: survey.id,
      status: 'completed'
    });

    if (existingAnalyses.length > 0) {
      return Response.json({ message: 'Analysis already completed for today' });
    }

    // Check minimum response threshold
    const responses = await base44.asServiceRole.entities.FeedbackSurveyResponse.filter({
      survey_id: survey.id,
      dismissed_without_completing: false
    });

    if (responses.length < 1) {
      return Response.json({ message: 'Not enough responses to analyze yet' });
    }

    // Trigger analysis
    const result = await base44.asServiceRole.functions.invoke('analyzeFeedbackSurvey', {
      survey_id: survey.id
    });

    return Response.json({ success: true, analysis_result: result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});