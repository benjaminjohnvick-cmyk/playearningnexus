import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Entity automation: triggered on PPCSurveyResponse create/update
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data?.user_id) {
      return Response.json({ error: 'Missing user data' }, { status: 400 });
    }

    const userId = data.user_id;

    // Fetch user's responses
    const responses = await base44.asServiceRole.entities.PPCSurveyResponse.filter({
      user_id: userId
    });

    if (responses.length === 0) {
      return Response.json({ message: 'No responses to score' });
    }

    // Calculate quality score (average of all response quality scores)
    const avgQualityScore = responses.reduce((sum, r) => sum + (r.quality_score || 0), 0) / responses.length;

    // Calculate time accuracy score
    const timeAccuracyScore = calculateTimeAccuracy(responses);

    // Get demographic verification level
    const userProfile = await base44.asServiceRole.entities.RespondentProfile.filter({
      user_id: userId
    }).then(profiles => profiles[0]);

    const demographicLevel = userProfile?.is_verified ? 'verified' : 'basic';

    // Count flagged responses
    const flaggedResponses = await base44.asServiceRole.entities.FlaggedResponse.filter({
      respondent_id: userId,
      status: 'rejected'
    });

    // Weighted trust score calculation
    const weightedScore =
      (avgQualityScore * 0.40) + // 40% quality
      (timeAccuracyScore * 0.30) + // 30% time accuracy
      (getDemographicScore(demographicLevel) * 0.30); // 30% verification

    // Determine trust tier
    const trustTier = getTrustTier(weightedScore, flaggedResponses.length / responses.length);

    // Get or create trust score record
    const existingScore = await base44.asServiceRole.entities.RespondentTrustScore.filter({
      user_id: userId
    }).then(scores => scores[0]);

    if (existingScore) {
      await base44.asServiceRole.entities.RespondentTrustScore.update(existingScore.id, {
        response_quality_score: Math.round(avgQualityScore),
        time_accuracy_score: Math.round(timeAccuracyScore),
        demographic_verification_level: demographicLevel,
        flagged_responses_count: flaggedResponses.length,
        total_responses_count: responses.length,
        overall_trust_score: Math.round(weightedScore),
        trust_tier: trustTier,
        last_calculated_at: new Date().toISOString()
      });
    } else {
      await base44.asServiceRole.entities.RespondentTrustScore.create({
        user_id: userId,
        response_quality_score: Math.round(avgQualityScore),
        time_accuracy_score: Math.round(timeAccuracyScore),
        demographic_verification_level: demographicLevel,
        flagged_responses_count: flaggedResponses.length,
        total_responses_count: responses.length,
        overall_trust_score: Math.round(weightedScore),
        trust_tier: trustTier,
        last_calculated_at: new Date().toISOString()
      });
    }

    return Response.json({
      user_id: userId,
      trust_score: Math.round(weightedScore),
      trust_tier: trustTier,
      quality_score: Math.round(avgQualityScore),
      time_accuracy: Math.round(timeAccuracyScore)
    });
  } catch (error) {
    console.error('Trust score calculation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function calculateTimeAccuracy(responses) {
  if (responses.length < 2) return 100;

  // Calculate standard deviation of response times
  const avgTime = responses.reduce((sum, r) => sum + (r.time_taken_seconds || 0), 0) / responses.length;
  const variance = responses.reduce((sum, r) => {
    const diff = (r.time_taken_seconds || 0) - avgTime;
    return sum + (diff * diff);
  }, 0) / responses.length;
  const stdDev = Math.sqrt(variance);

  // Lower std dev = higher consistency = higher score (0-100)
  const consistencyScore = Math.max(0, 100 - (stdDev / avgTime) * 100);
  return Math.min(100, consistencyScore);
}

function getDemographicScore(level) {
  return {
    unverified: 30,
    basic: 60,
    verified: 85,
    fully_verified: 100
  }[level] || 30;
}

function getTrustTier(score, flagRatio) {
  // Penalize high flag ratio
  const adjustedScore = score * (1 - flagRatio * 0.5);
  
  if (adjustedScore >= 85) return 'premium';
  if (adjustedScore >= 70) return 'high';
  if (adjustedScore >= 50) return 'medium';
  return 'low';
}