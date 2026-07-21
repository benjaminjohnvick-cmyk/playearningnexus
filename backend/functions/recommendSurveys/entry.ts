import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user's completed surveys and interests
    const completedSurveys = await base44.asServiceRole.entities.PPCSurveyResponse.filter({ user_id: user.id });
    const completedCategories = completedSurveys.map(s => s.category).filter(Boolean);
    const avgEarningsPerSurvey = user.total_earnings / (completedSurveys.length || 1);
    const completionRate = completedSurveys.length / (user.surveys_seen || 1);

    // Get available surveys
    const allSurveys = await base44.asServiceRole.entities.PPCSurvey.filter({ status: 'active' });

    // Score each survey
    const recommendations = allSurveys.map(survey => {
      let score = 0;
      let matchReason = 'trending_popular';

      // Interest match (category overlap)
      if (completedCategories.includes(survey.category)) {
        score += 35;
        matchReason = 'interest_match';
      }

      // Earning pattern match (similar payout to user's average)
      if (Math.abs(survey.reward - avgEarningsPerSurvey) < 2) {
        score += 25;
        matchReason = 'earning_pattern';
      } else if (survey.reward > avgEarningsPerSurvey * 1.5) {
        score += 15;
        matchReason = 'high_payout';
      }

      // Completion history (user has high completion rate)
      if (completionRate > 0.8) {
        score += 20;
        matchReason = 'completion_history';
      }

      // Trending/popular
      if (survey.completion_count > 1000) {
        score += 10;
      }

      // Estimate probability to complete
      const probability = Math.min(
        100,
        (completionRate * 50) + (score > 70 ? 30 : score > 50 ? 15 : 5)
      );

      return {
        survey_id: survey.id,
        survey_title: survey.title,
        survey_reward: survey.reward,
        recommendation_score: Math.min(100, score),
        match_reason: matchReason,
        probability_to_complete: probability,
        estimated_earnings: survey.reward,
      };
    })
    .filter(r => r.recommendation_score >= 50)
    .sort((a, b) => b.recommendation_score - a.recommendation_score)
    .slice(0, 10);

    // Create recommendation records
    const created = [];
    for (const rec of recommendations) {
      const existing = await base44.asServiceRole.entities.SurveyRecommendation.filter({
        user_id: user.id,
        survey_id: rec.survey_id,
      });

      if (existing.length === 0) {
        const record = await base44.asServiceRole.entities.SurveyRecommendation.create({
          ...rec,
          user_id: user.id,
          ai_rationale: `This survey matches your ${rec.match_reason.replace(/_/g, ' ')} with ${rec.probability_to_complete.toFixed(0)}% completion likelihood.`,
          recommended_at: new Date().toISOString(),
        });
        created.push(record);
      }
    }

    return Response.json({
      success: true,
      recommendations: recommendations,
      saved_count: created.length,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});