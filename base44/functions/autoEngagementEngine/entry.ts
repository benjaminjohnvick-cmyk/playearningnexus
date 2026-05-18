import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Category 2: User Engagement & Experience Automation
// Handles: Personalized recommendations, gamification, survey personalization, feedback integration, proactive support
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};

    // 1. Personalized Game & Survey Recommendations for recent users
    const recentUsers = await base44.asServiceRole.entities.User.list('-created_date', 50);
    let recommendationsGenerated = 0;
    for (const u of recentUsers.slice(0, 15)) {
      await base44.asServiceRole.functions.invoke('batchGameRecommendations', { user_id: u.id });
      await base44.asServiceRole.functions.invoke('recommendSurveys', { user_id: u.id });
      recommendationsGenerated++;
    }
    results.recommendations_generated = recommendationsGenerated;

    // 2. Gamification — awards, achievements, daily goals
    await base44.asServiceRole.functions.invoke('batchAwardAchievements', {});
    await base44.asServiceRole.functions.invoke('batchDailyGoalGenerator', {});
    await base44.asServiceRole.functions.invoke('awardUserXP', { batch: true });
    results.gamification_processed = true;

    // 3. Survey Personalization — match & distribute
    await base44.asServiceRole.functions.invoke('aiSurveyMatchEngine', {});
    await base44.asServiceRole.functions.invoke('aiSurveyAutoDistribute', {});
    await base44.asServiceRole.functions.invoke('rankSurveysForUser', { batch: true });
    results.surveys_personalized = true;

    // 4. User Feedback Integration — analyze suggestions, inject top ones into surveys
    await base44.asServiceRole.functions.invoke('autoUserSuggestionLifecycle', {});
    await base44.asServiceRole.functions.invoke('runDailyFeedbackAnalysis', {});
    results.feedback_processed = true;

    // 5. Proactive Support — analyze tickets + UX sessions
    await base44.asServiceRole.functions.invoke('proactiveSupportAnalyzer', {});
    await base44.asServiceRole.functions.invoke('aiSupportEngine', {});
    results.proactive_support_triggered = true;

    // 6. AI Game Creator — generate game concepts from feedback
    await base44.asServiceRole.functions.invoke('aiGameCreatorFromFeedback', {});
    results.ai_game_concepts_generated = true;

    // 7. Daily streak and milestone checks
    await base44.asServiceRole.functions.invoke('milestoneAlertChecker', {});
    results.milestones_checked = true;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});