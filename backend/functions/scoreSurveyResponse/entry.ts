import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

/**
 * Dynamic Quality Scoring Engine
 * Scores individual responses AND updates per-category quality metrics.
 * Factors: completion rate, time spent, rejection rate, straight-lining, variance.
 */
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { response_id, survey_id } = await req.json();
    if (!response_id || !survey_id) return Response.json({ error: 'Missing response_id or survey_id' }, { status: 400 });

    const [responseArr, surveyArr] = await Promise.all([
      base44.asServiceRole.entities.PPCSurveyResponse.filter({ id: response_id }),
      base44.asServiceRole.entities.PPCSurvey.filter({ id: survey_id }),
    ]);

    const resp = responseArr[0];
    const surv = surveyArr[0];
    if (!resp || !surv) return Response.json({ error: 'Response or survey not found' }, { status: 404 });

    const answers = resp.answers || [];
    const totalQuestions = surv.questions?.length || 10;
    const category = surv.survey_type || 'general';

    let score = 100;
    const penalties = [];

    // 1. Completion penalty
    const completionRate = answers.length / totalQuestions;
    if (completionRate < 1) {
      const penalty = Math.round((1 - completionRate) * 40);
      score -= penalty;
      penalties.push(`Incomplete: -${penalty}`);
    }

    // 2. Straight-lining detection
    if (answers.length >= 5) {
      const optionCounts = {};
      answers.forEach(a => { optionCounts[a.selected_option] = (optionCounts[a.selected_option] || 0) + 1; });
      const maxSame = Math.max(...Object.values(optionCounts));
      const ratio = maxSame / answers.length;
      if (ratio >= 0.9) { score -= 30; penalties.push('Straight-lining: -30'); }
      else if (ratio >= 0.7) { score -= 15; penalties.push('Partial straight-lining: -15'); }
    }

    // 3. Speed penalty
    const timeTaken = resp.time_taken_seconds || 0;
    const minExpected = totalQuestions * 8;
    if (timeTaken > 0 && timeTaken < minExpected * 0.3) { score -= 25; penalties.push('Suspiciously fast: -25'); }
    else if (timeTaken > 0 && timeTaken < minExpected * 0.6) { score -= 10; penalties.push('Faster than expected: -10'); }

    // 4. Answer variance bonus
    const uniqueOptions = new Set(answers.map(a => a.selected_option)).size;
    if (uniqueOptions >= 3) score = Math.min(100, score + 5);

    // 5. Category-adjusted bonus — reward users in high-quality categories
    // Fetch category baseline to apply dynamic adjustment
    const categoryResponses = await base44.asServiceRole.entities.PPCSurveyResponse.filter(
      { completed: true }, '-created_date', 500
    );
    const sameCatSurveyIds = new Set();
    // We'll use survey type as category proxy
    const allSurveys = await base44.asServiceRole.entities.PPCSurvey.filter({ survey_type: category });
    allSurveys.forEach(s => sameCatSurveyIds.add(s.id));
    const catResponses = categoryResponses.filter(r => sameCatSurveyIds.has(r.survey_id));

    let categoryScore = 70; // default baseline
    if (catResponses.length >= 5) {
      const scored = catResponses.filter(r => r.quality_score != null);
      const rejected = catResponses.filter(r => r.is_blocked || r.is_flagged);
      const avgTime = catResponses.reduce((s, r) => s + (r.time_taken_seconds || 0), 0) / catResponses.length;
      const catCompletionRate = catResponses.filter(r => r.completed).length / catResponses.length;
      const catRejectionRate = rejected.length / catResponses.length;
      const catAvgQuality = scored.length ? scored.reduce((s, r) => s + r.quality_score, 0) / scored.length : 70;

      // Dynamic category score (0-100)
      categoryScore = Math.round(
        catAvgQuality * 0.4 +
        catCompletionRate * 100 * 0.35 +
        (1 - catRejectionRate) * 100 * 0.25
      );

      // Store category quality metadata on the survey
      await base44.asServiceRole.entities.PPCSurvey.update(survey_id, {
        avg_quality_score: Math.round(catAvgQuality),
        avg_completion_time_seconds: Math.round(avgTime),
      });
    }

    // Slight bonus if category score is high (rewards high-quality categories)
    if (categoryScore >= 80 && score >= 70) {
      score = Math.min(100, score + 3);
    }

    score = Math.max(0, Math.min(100, score));

    // Flag low-quality for review
    const isLowQuality = score < 40;
    const isFraudRisk = penalties.some(p => p.includes('Straight-lining') || p.includes('Suspiciously fast'));

    // Save score on response
    await base44.asServiceRole.entities.PPCSurveyResponse.update(response_id, {
      quality_score: score,
      quality_penalties: penalties,
      is_flagged: isLowQuality || isFraudRisk,
      flag_reason: isLowQuality || isFraudRisk ? penalties.join('; ') : null,
    });

    // Log flagged responses to AgentPerformanceLog
    if (isLowQuality || isFraudRisk) {
      await base44.asServiceRole.entities.AgentPerformanceLog.create({
        agent_name: 'survey_quality_scorer',
        action_type: 'quality_flag',
        target_entity: 'PPCSurveyResponse',
        target_id: response_id,
        input_data: { time_taken: timeTaken, completion_rate: completionRate, answer_count: answers.length },
        output_data: { score, penalties, is_fraud_risk: isFraudRisk },
        predicted_outcome: isFraudRisk ? 'Potential fraudulent response' : 'Low quality — needs review',
        confidence_score: isFraudRisk ? 85 : 60,
        tags: ['quality_scoring', isFraudRisk ? 'fraud_risk' : 'low_quality'],
        human_review_status: 'pending',
      });
    }

    // Update rolling avg on survey
    const allResps = await base44.asServiceRole.entities.PPCSurveyResponse.filter({ survey_id, completed: true });
    const scored = allResps.filter(r => r.quality_score != null);
    if (scored.length > 0) {
      const avg = scored.reduce((s, r) => s + r.quality_score, 0) / scored.length;
      await base44.asServiceRole.entities.PPCSurvey.update(survey_id, { avg_quality_score: Math.round(avg) });
    }

    // Update user's RespondentTrustScore
    const trustArr = await base44.asServiceRole.entities.RespondentTrustScore.filter({ user_id: resp.user_id });
    const userResps = await base44.asServiceRole.entities.PPCSurveyResponse.filter({ user_id: resp.user_id, completed: true });
    const scoredUserResps = userResps.filter(r => r.quality_score != null);
    const avgUserQuality = scoredUserResps.length
      ? scoredUserResps.reduce((s, r) => s + r.quality_score, 0) / scoredUserResps.length
      : score;
    const flaggedCount = userResps.filter(r => r.is_flagged).length;
    const overallTrust = Math.max(0, Math.min(100, Math.round(
      avgUserQuality * 0.6 + (1 - flaggedCount / Math.max(userResps.length, 1)) * 100 * 0.4
    )));
    const trustTier = overallTrust >= 85 ? 'premium' : overallTrust >= 65 ? 'high' : overallTrust >= 40 ? 'medium' : 'low';

    if (trustArr.length > 0) {
      await base44.asServiceRole.entities.RespondentTrustScore.update(trustArr[0].id, {
        response_quality_score: Math.round(avgUserQuality),
        overall_trust_score: overallTrust,
        trust_tier: trustTier,
        total_responses_count: userResps.length,
        flagged_responses_count: flaggedCount,
        last_calculated_at: new Date().toISOString(),
      });
    } else {
      await base44.asServiceRole.entities.RespondentTrustScore.create({
        user_id: resp.user_id,
        response_quality_score: Math.round(avgUserQuality),
        overall_trust_score: overallTrust,
        trust_tier: trustTier,
        total_responses_count: userResps.length,
        flagged_responses_count: flaggedCount,
        last_calculated_at: new Date().toISOString(),
      });
    }

    return Response.json({ success: true, quality_score: score, penalties, category_score: categoryScore, trust_tier: trustTier });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});