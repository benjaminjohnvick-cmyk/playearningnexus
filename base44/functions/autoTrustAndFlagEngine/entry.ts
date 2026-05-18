import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: respondent trust scores, flagged responses, ABTest conclusions, push subscriptions, earnings monitor
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Batch recalculate respondent trust scores
    const respondents = await base44.asServiceRole.entities.RespondentTrustScore.list('-updated_date', 100);
    let scoresUpdated = 0;
    for (const resp of respondents) {
      const ageHours = (Date.now() - new Date(resp.updated_date || resp.created_date).getTime()) / 3600000;
      if (ageHours > 6) { // Recalculate every 6 hours
        await base44.asServiceRole.functions.invoke('computeUserTrustScore', { user_id: resp.user_id });
        await base44.asServiceRole.functions.invoke('calculateTrustScore', { user_id: resp.user_id });
        scoresUpdated++;
      }
    }
    results.trust_scores_recalculated = scoresUpdated;

    // 2. Auto-escalate flagged responses
    const flaggedResponses = await base44.asServiceRole.entities.FlaggedResponse.filter({ status: 'pending' });
    let escalated = 0;
    for (const flagged of flaggedResponses.slice(0, 30)) {
      const ageHours = (Date.now() - new Date(flagged.created_date).getTime()) / 3600000;
      if (ageHours > 2) { // Escalate after 2 hours
        await base44.asServiceRole.entities.FlaggedResponse.update(flagged.id, {
          status: 'escalated',
          escalated_at: now
        });
        // Create a survey dispute
        await base44.asServiceRole.entities.SurveyDispute.create({
          user_id: flagged.user_id,
          survey_id: flagged.survey_id,
          response_id: flagged.response_id,
          reason: 'auto_flagged',
          status: 'open',
          created_at: now
        });
        escalated++;
      }
    }
    results.flagged_responses_escalated = escalated;

    // 3. Auto-analyze survey disputes
    const openDisputes = await base44.asServiceRole.entities.SurveyDispute.filter({ status: 'open' });
    let disputesAnalyzed = 0;
    for (const dispute of openDisputes.slice(0, 20)) {
      await base44.asServiceRole.functions.invoke('surveyUXFraudAnalyzer', { dispute_id: dispute.id });
      disputesAnalyzed++;
    }
    results.survey_disputes_analyzed = disputesAnalyzed;

    // 4. Conclude A/B tests that have reached statistical significance or duration
    const activeABTests = await base44.asServiceRole.entities.ABTest.filter({ status: 'active' });
    let abTestsConcluded = 0;
    for (const test of activeABTests) {
      const ageDays = (Date.now() - new Date(test.created_date).getTime()) / 86400000;
      if (ageDays >= (test.duration_days || 14)) {
        await base44.asServiceRole.entities.ABTest.update(test.id, {
          status: 'completed',
          concluded_at: now
        });
        await base44.asServiceRole.functions.invoke('abTestAssigner', { test_id: test.id, action: 'conclude' });
        abTestsConcluded++;
      }
    }
    results.ab_tests_concluded = abTestsConcluded;

    // 5. AI Earnings Monitor — flag users with anomalous earning patterns
    const earningsMonitors = await base44.asServiceRole.entities.AIEarningsMonitor.filter({ status: 'active' });
    results.earnings_monitors_active = earningsMonitors.length;
    await base44.asServiceRole.functions.invoke('earningVelocityMonitor', {});
    results.earning_velocity_checked = true;

    // 6. Push subscription batch processing
    const activePushSubs = await base44.asServiceRole.entities.PushSubscription.filter({ is_active: true });
    results.active_push_subscriptions = activePushSubs.length;

    // 7. Partner tier auto-upgrade checks
    const partnerTiers = await base44.asServiceRole.entities.PartnerTier.filter({ status: 'active' });
    let tierUpgrades = 0;
    for (const tier of partnerTiers) {
      // Check if business client qualifies for higher tier
      if (tier.current_installs >= tier.next_tier_threshold && tier.current_tier < tier.max_tier) {
        await base44.asServiceRole.entities.PartnerTier.update(tier.id, {
          current_tier: tier.current_tier + 1,
          upgraded_at: now
        });
        tierUpgrades++;
      }
    }
    results.partner_tier_upgrades = tierUpgrades;
    await base44.asServiceRole.functions.invoke('autoPartnerTierAndSettings', {});
    results.partner_tier_settings_synced = true;

    // 8. Contest power-up expiry
    const activePowerUps = await base44.asServiceRole.entities.ContestPowerUp.filter({ status: 'active' });
    let powerUpsExpired = 0;
    for (const powerUp of activePowerUps) {
      if (powerUp.expires_at && powerUp.expires_at < now) {
        await base44.asServiceRole.entities.ContestPowerUp.update(powerUp.id, { status: 'expired' });
        powerUpsExpired++;
      }
    }
    results.contest_power_ups_expired = powerUpsExpired;

    // 9. Detect suspicious survey responses
    await base44.asServiceRole.functions.invoke('detectSuspiciousResponses', {});
    results.suspicious_responses_detected = true;

    // 10. Check survey fraud
    await base44.asServiceRole.functions.invoke('checkSurveyFraud', {});
    results.survey_fraud_checked = true;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});