import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Category 2: User Engagement & Experience Automation
// Handles: Personalized recommendations, gamification, survey personalization, feedback integration, proactive support
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const results = {};
    const errors = [];

    const invoke = async (functionName, payload) => {
      try {
        return await base44.asServiceRole.functions.invoke(functionName, payload);
      } catch (err) {
        errors.push({ function: functionName, error: err.message });
        return null;
      }
    };

    // 1. Personalized Game & Survey Recommendations for recent users
    const recentUsers = await base44.asServiceRole.entities.User.list('-created_date', 50);
    let recommendationsGenerated = 0;
    for (const u of recentUsers.slice(0, 15)) {
      await invoke('batchGameRecommendations', { user_id: u.id });
      await invoke('recommendSurveys', { user_id: u.id });
      recommendationsGenerated++;
    }
    results.recommendations_generated = recommendationsGenerated;

    // 2. Gamification — awards, achievements, daily goals
    await invoke('batchAwardAchievements', {});
    await invoke('batchDailyGoalGenerator', {});
    await invoke('awardUserXP', { batch: true });
    results.gamification_processed = true;

    // 3. Survey Personalization — match & distribute
    await invoke('aiSurveyMatchEngine', {});
    await invoke('aiSurveyAutoDistribute', {});
    await invoke('rankSurveysForUser', { batch: true });
    results.surveys_personalized = true;

    // 4. User Feedback Integration — analyze suggestions, inject top ones into surveys
    await invoke('autoUserSuggestionLifecycle', {});
    await invoke('runDailyFeedbackAnalysis', {});
    results.feedback_processed = true;

    // 5. Proactive Support — analyze tickets + UX sessions
    await invoke('proactiveSupportAnalyzer', {});
    await invoke('aiSupportEngine', {});
    results.proactive_support_triggered = true;

    // 6. AI Game Creator — generate game concepts from feedback
    await invoke('aiGameCreatorFromFeedback', {});
    results.ai_game_concepts_generated = true;

    // 7. Daily streak and milestone checks
    await invoke('milestoneAlertChecker', {});
    results.milestones_checked = true;

    return Response.json({ success: true, results, errors: errors.length > 0 ? errors : undefined });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});