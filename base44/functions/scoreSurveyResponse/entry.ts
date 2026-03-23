import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

/**
 * Calculates a Data Quality Score (0-100) for a PPCSurveyResponse.
 * Factors: completion, time taken, answer variance, straight-lining detection.
 * Called after a response is submitted.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { response_id, survey_id } = await req.json();
    if (!response_id || !survey_id) return Response.json({ error: 'Missing response_id or survey_id' }, { status: 400 });

    const [response, survey] = await Promise.all([
      base44.asServiceRole.entities.PPCSurveyResponse.filter({ id: response_id }),
      base44.asServiceRole.entities.PPCSurvey.filter({ id: survey_id }),
    ]);

    const resp = response[0];
    const surv = survey[0];

    if (!resp || !surv) return Response.json({ error: 'Response or survey not found' }, { status: 404 });

    const answers = resp.answers || [];
    const totalQuestions = surv.questions?.length || 10;

    let score = 100;
    const penalties = [];

    // 1. Completion penalty
    const completionRate = answers.length / totalQuestions;
    if (completionRate < 1) {
      const penalty = Math.round((1 - completionRate) * 40);
      score -= penalty;
      penalties.push(`Incomplete: -${penalty}`);
    }

    // 2. Straight-lining detection (all same answer)
    if (answers.length >= 5) {
      const optionCounts = {};
      answers.forEach(a => {
        optionCounts[a.selected_option] = (optionCounts[a.selected_option] || 0) + 1;
      });
      const maxSame = Math.max(...Object.values(optionCounts));
      const straightLineRatio = maxSame / answers.length;
      if (straightLineRatio >= 0.9) {
        score -= 30;
        penalties.push('Straight-lining detected: -30');
      } else if (straightLineRatio >= 0.7) {
        score -= 15;
        penalties.push('Partial straight-lining: -15');
      }
    }

    // 3. Speed penalty (too fast = bot-like)
    const timeTaken = resp.time_taken_seconds || 0;
    const minExpectedSeconds = totalQuestions * 8; // ~8 seconds per question minimum
    if (timeTaken > 0 && timeTaken < minExpectedSeconds * 0.3) {
      score -= 25;
      penalties.push('Suspiciously fast: -25');
    } else if (timeTaken > 0 && timeTaken < minExpectedSeconds * 0.6) {
      score -= 10;
      penalties.push('Faster than expected: -10');
    }

    // 4. Answer variance bonus
    const uniqueOptions = new Set(answers.map(a => a.selected_option)).size;
    if (uniqueOptions >= 3) {
      score = Math.min(100, score + 5);
    }

    score = Math.max(0, Math.min(100, score));

    // Save quality score on the response
    await base44.asServiceRole.entities.PPCSurveyResponse.update(response_id, {
      quality_score: score,
      quality_penalties: penalties,
    });

    // Update rolling average on the survey
    const allResponses = await base44.asServiceRole.entities.PPCSurveyResponse.filter({ survey_id, completed: true });
    const scoredResponses = allResponses.filter(r => r.quality_score !== undefined && r.quality_score !== null);
    if (scoredResponses.length > 0) {
      const avgScore = scoredResponses.reduce((sum, r) => sum + (r.quality_score || 0), 0) / scoredResponses.length;
      await base44.asServiceRole.entities.PPCSurvey.update(survey_id, {
        avg_quality_score: Math.round(avgScore),
      });
    }

    return Response.json({ success: true, quality_score: score, penalties });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});