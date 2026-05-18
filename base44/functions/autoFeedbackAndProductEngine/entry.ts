import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: daily feedback surveys, mockup vote generation, user suggestions, feature pipeline, A/B tests
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const results = {};
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Generate daily feedback survey
    await base44.asServiceRole.functions.invoke('generateDailyFeedbackSurvey', {});
    results.daily_feedback_survey_generated = true;

    // 2. Run daily feedback analysis
    await base44.asServiceRole.functions.invoke('runDailyFeedbackAnalysis', {});
    await base44.asServiceRole.functions.invoke('analyzeFeedbackSurvey', {});
    results.feedback_analysis_run = true;

    // 3. Generate mockup vote survey from feedback
    await base44.asServiceRole.functions.invoke('generateMockupVoteSurvey', {});
    results.mockup_vote_survey_generated = true;

    // 4. Conclude mockup votes and queue winning designs
    await base44.asServiceRole.functions.invoke('autoMockupVoteConclusion', {});
    results.mockup_votes_concluded = true;

    // 5. Process user suggestions — score and route
    await base44.asServiceRole.functions.invoke('autoUserSuggestionLifecycle', {});
    results.user_suggestions_processed = true;

    // 6. Feature mockup pipeline
    await base44.asServiceRole.functions.invoke('featureMockupPipeline', {});
    results.feature_mockup_pipeline_run = true;

    // 7. AI feedback A/B optimizer
    await base44.asServiceRole.functions.invoke('aiFeedbackABOptimizer', {});
    results.feedback_ab_tests_optimized = true;

    // 8. Survey heatmap analysis
    await base44.asServiceRole.functions.invoke('aiSurveyHeatmapAnalyzer', {});
    results.survey_heatmaps_analyzed = true;

    // 9. A/B test tracking and metric recording
    await base44.asServiceRole.functions.invoke('trackABTestMetrics', {});
    await base44.asServiceRole.functions.invoke('abTestAssigner', {});
    results.ab_tests_tracked = true;

    // 10. Process pending product submissions
    const pendingProducts = await base44.asServiceRole.entities.PendingProduct.filter({ status: 'pending' });
    let productsReviewed = 0;
    for (const product of pendingProducts.slice(0, 20)) {
      await base44.asServiceRole.functions.invoke('submitProductForReview', { product_id: product.id });
      productsReviewed++;
    }
    results.products_submitted_for_review = productsReviewed;

    // 11. Generate AI content library
    await base44.asServiceRole.functions.invoke('aiGenerateContentLibrary', {});
    results.content_library_updated = true;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});