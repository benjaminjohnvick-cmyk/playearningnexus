import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Entity automation: triggered on PPCSurveyResponse create/update
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data } = await req.json();

    if (!data?.survey_id) {
      return Response.json({ error: 'Missing survey_id' }, { status: 400 });
    }

    // Find A/B test that includes this survey
    const abTests = await base44.asServiceRole.entities.SurveyABTest.filter({});
    const relevantTest = abTests.find(t => t.survey_a_id === data.survey_id || t.survey_b_id === data.survey_id);

    if (!relevantTest) {
      return Response.json({ message: 'Survey not part of an A/B test' });
    }

    // Determine which variant
    const isVariantA = data.survey_id === relevantTest.survey_a_id;

    // Get all responses for this variant
    const variantResponses = await base44.asServiceRole.entities.PPCSurveyResponse.filter({
      survey_id: data.survey_id
    });

    // Calculate metrics
    const totalResponses = variantResponses.length;
    const completedResponses = variantResponses.filter(r => r.completed).length;
    const completionRate = totalResponses > 0 ? Math.round((completedResponses / totalResponses) * 100) : 0;
    const avgQualityScore = variantResponses.length > 0
      ? Math.round(variantResponses.reduce((sum, r) => sum + (r.quality_score || 0), 0) / variantResponses.length)
      : 0;

    // Update A/B test record
    const updates = isVariantA
      ? {
          variant_a_responses: totalResponses,
          variant_a_completions: completedResponses,
          variant_a_completion_rate: completionRate,
          variant_a_quality_score: avgQualityScore
        }
      : {
          variant_b_responses: totalResponses,
          variant_b_completions: completedResponses,
          variant_b_completion_rate: completionRate,
          variant_b_quality_score: avgQualityScore
        };

    // Check for winner (if both have enough data)
    const updatedTest = { ...relevantTest, ...updates };
    let winner = 'inconclusive';

    if (updatedTest.variant_a_responses >= updatedTest.sample_size_each && updatedTest.variant_b_responses >= updatedTest.sample_size_each) {
      const aScore = (updatedTest.variant_a_completion_rate * 0.6) + (updatedTest.variant_a_quality_score * 0.4);
      const bScore = (updatedTest.variant_b_completion_rate * 0.6) + (updatedTest.variant_b_quality_score * 0.4);

      if (aScore > bScore * 1.05) {
        winner = 'a';
      } else if (bScore > aScore * 1.05) {
        winner = 'b';
      } else {
        winner = 'tie';
      }

      updates.winner = winner;
      updates.winner_determined_at = new Date().toISOString();
      updates.status = 'completed';
    }

    await base44.asServiceRole.entities.SurveyABTest.update(relevantTest.id, updates);

    return Response.json({
      test_id: relevantTest.id,
      variant: isVariantA ? 'a' : 'b',
      completion_rate: completionRate,
      quality_score: avgQualityScore,
      winner
    });
  } catch (error) {
    console.error('A/B test tracking error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});