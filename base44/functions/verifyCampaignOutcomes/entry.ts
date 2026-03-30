import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

/**
 * Checks retention campaigns after 7+ days to verify if users returned.
 * Updates campaign records and agent performance logs with actual outcomes.
 * Runs daily as a scheduled automation.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let callerIsAdmin = false;
    try { const u = await base44.auth.me(); callerIsAdmin = u?.role === 'admin'; } catch (_) { callerIsAdmin = true; }
    if (!callerIsAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const campaigns = await base44.asServiceRole.entities.RetentionCampaign.filter(
      { status: 'sent' }, '-created_date', 200
    );

    let verified = 0;
    let converted = 0;

    for (const campaign of campaigns) {
      const daysSinceSent = (Date.now() - new Date(campaign.created_date)) / 86400000;
      if (daysSinceSent < 7) continue; // wait 7 days before verifying

      // Check if user completed surveys after the campaign was sent
      const responses = await base44.asServiceRole.entities.PPCSurveyResponse.filter(
        { user_id: campaign.user_id }, '-created_date', 20
      );

      const returnedAfter = responses.some(r => new Date(r.created_date) > new Date(campaign.created_date));
      const surveysAfter = responses.filter(r => new Date(r.created_date) > new Date(campaign.created_date)).length;

      // Estimate revenue recovered (avg $0.75 per survey)
      const revenueRecovered = surveysAfter * 0.75;

      await base44.asServiceRole.entities.RetentionCampaign.update(campaign.id, {
        user_returned: returnedAfter,
        user_returned_at: returnedAfter ? new Date().toISOString() : undefined,
        surveys_completed_after: surveysAfter,
        revenue_recovered: revenueRecovered,
        campaign_success: returnedAfter,
        status: returnedAfter ? 'converted' : 'expired'
      });

      // Update the linked AgentPerformanceLog
      if (campaign.agent_log_id) {
        await base44.asServiceRole.entities.AgentPerformanceLog.update(campaign.agent_log_id, {
          actual_outcome: returnedAfter ? 'user_returned' : 'user_did_not_return',
          was_correct: returnedAfter,
          outcome_verified: true,
          outcome_verified_at: new Date().toISOString(),
          impact_score: Math.min(100, Math.round(revenueRecovered * 10))
        });
      }

      // Update retention risk status if they came back
      if (returnedAfter) {
        const risks = await base44.asServiceRole.entities.RetentionRisk.filter({ user_id: campaign.user_id });
        if (risks[0]) {
          await base44.asServiceRole.entities.RetentionRisk.update(risks[0].id, { status: 'recovered' });
        }
        converted++;
      }

      verified++;
    }

    return Response.json({ success: true, campaigns_verified: verified, converted });
  } catch (error) {
    console.error('verifyCampaignOutcomes error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});