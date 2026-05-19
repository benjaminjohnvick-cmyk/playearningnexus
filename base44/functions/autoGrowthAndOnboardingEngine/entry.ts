import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: user onboarding, growth heatmap, LTV optimization, churn prevention, referral growth
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const results = {};
  const errors = [];

  const invoke = async (name, payload = {}) => {
    try {
      await base44.asServiceRole.functions.invoke(name, payload);
    } catch (e) {
      errors.push({ fn: name, error: e.message });
    }
  };

  // 1. AI onboarding personalization for new users
  try {
    const newUsers = await base44.asServiceRole.entities.User.filter({ onboarding_completed: false });
    let onboardingRun = 0;
    for (const u of newUsers.slice(0, 20)) {
      try {
        await base44.asServiceRole.functions.invoke('aiOnboardingPersonalizer', { user_id: u.id });
        onboardingRun++;
      } catch (e) {
        errors.push({ fn: 'aiOnboardingPersonalizer', id: u.id, error: e.message });
      }
    }
    results.onboarding_personalized = onboardingRun;
  } catch (e) {
    errors.push({ fn: 'new_users_fetch', error: e.message });
  }

  // 2. Profile setup automation
  await invoke('autoProfileSetup');
  await invoke('autoProfileCompletion');
  results.profiles_completed = true;

  // 3. Growth heatmap data collection
  try {
    const growthData = await base44.asServiceRole.entities.GrowthHeatmapData.list('-created_date', 5);
    results.growth_data_records = growthData.length;
  } catch (e) {
    errors.push({ fn: 'growth_heatmap_fetch', error: e.message });
  }

  // 4. LTV prediction and optimization
  await invoke('aiLTVPredictionEngine');
  results.ltv_predictions_updated = true;

  // 5. Churn prevention
  await invoke('aiChurnPredictionEngine');
  await invoke('churnPredictionEngine');
  await invoke('aiUserRetention');
  await invoke('aiRetentionOptimizer');
  results.churn_prevention_run = true;

  // 6. Referral growth engine
  await invoke('autoReferralCampaignManager');
  results.referral_growth_managed = true;

  // 7. Growth content engine
  await invoke('aiGrowthContentEngine');
  results.growth_content_generated = true;

  // 8. Agent self-improvement
  await invoke('aiAgentSelfImprovementEngine');
  await invoke('aiAutoLearningOrchestrator');
  results.agent_self_improvement_run = true;

  // 9. Feature learning framework
  await invoke('aiFeatureLearningFramework');
  results.feature_learning_run = true;

  // 10. Automatic feature implementation from top suggestions
  await invoke('aiAutomaticFeatureImplementation');
  results.auto_feature_implementation_run = true;

  // 11. Settings optimization
  await invoke('autoSettingsOptimization');
  results.settings_optimized = true;

  return Response.json({ success: true, results, errors });
});