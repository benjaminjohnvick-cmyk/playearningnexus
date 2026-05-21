import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Automates: marketing campaign lifecycle, performance tracking, auto-pause/resume, ROI analysis
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const results = {};
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Activate campaigns that have reached their start date
    const pendingCampaigns = await base44.asServiceRole.entities.MarketingCampaign.filter({ status: 'scheduled' });
    let campaignsActivated = 0;
    for (const campaign of pendingCampaigns) {
      if (campaign.start_date && campaign.start_date <= today) {
        await base44.asServiceRole.entities.MarketingCampaign.update(campaign.id, {
          status: 'active',
          activated_at: now
        });
        campaignsActivated++;
      }
    }
    results.campaigns_activated = campaignsActivated;

    // 2. Expire campaigns that have passed their end date
    const activeCampaigns = await base44.asServiceRole.entities.MarketingCampaign.filter({ status: 'active' });
    let campaignsExpired = 0;
    for (const campaign of activeCampaigns) {
      if (campaign.end_date && campaign.end_date < today) {
        await base44.asServiceRole.entities.MarketingCampaign.update(campaign.id, {
          status: 'completed',
          completed_at: now
        });
        campaignsExpired++;
      }
      // Auto-pause campaigns with low ROI (conversion rate < 0.1%)
      const impressions = campaign.impressions || 0;
      const conversions = campaign.conversions || 0;
      if (impressions > 10000 && conversions / impressions < 0.001) {
        await base44.asServiceRole.entities.MarketingCampaign.update(campaign.id, {
          status: 'paused',
          paused_reason: 'low_roi_auto_pause',
          paused_at: now
        });
        campaignsExpired++;
      }
    }
    results.campaigns_expired_or_paused = campaignsExpired;

    // 3. Sponsored content lifecycle
    const activeSponsoredContent = await base44.asServiceRole.entities.SponsoredContent.filter({ status: 'active' });
    let sponsoredExpired = 0;
    for (const content of activeSponsoredContent) {
      if (content.end_date && content.end_date < today) {
        await base44.asServiceRole.entities.SponsoredContent.update(content.id, { status: 'expired' });
        sponsoredExpired++;
      }
    }
    results.sponsored_content_expired = sponsoredExpired;

    // 4. AI marketing copy generation for active campaigns
    try {
      await base44.asServiceRole.functions.invoke('aiMarketingCopyGenerator', {});
      results.marketing_copy_generated = true;
    } catch (e) {
      results.marketing_copy_generated = false;
    }

    // 5. Campaign outcome verification
    try {
      await base44.asServiceRole.functions.invoke('verifyCampaignOutcomes', {});
      results.campaign_outcomes_verified = true;
    } catch (e) {
      results.campaign_outcomes_verified = false;
    }

    // 6. Email marketing flows — trigger sequences
    try {
      const activeFlows = await base44.asServiceRole.entities.EmailMarketingFlow.filter({ status: 'active' });
      let flowsTriggered = 0;
      for (const flow of activeFlows) {
        try {
          await base44.asServiceRole.functions.invoke('triggerEmailMarketing', { flow_id: flow.id });
          flowsTriggered++;
        } catch (e) {
          // Skip individual flow errors
        }
      }
      results.email_marketing_flows_triggered = flowsTriggered;
    } catch (e) {
      results.email_marketing_flows_triggered = 0;
    }

    // 7. Referral campaign manager
    try {
      await base44.asServiceRole.functions.invoke('autoReferralCampaignManager', {});
      results.referral_campaigns_managed = true;
    } catch (e) {
      results.referral_campaigns_managed = false;
    }

    // 8. Ad campaign creation for high-performing games
    try {
      await base44.asServiceRole.functions.invoke('autoAdCampaignCreation', {});
      results.ad_campaigns_created = true;
    } catch (e) {
      results.ad_campaigns_created = false;
    }

    // 9. PPC session processing
    try {
      await base44.asServiceRole.functions.invoke('processPPCSession', {});
      results.ppc_sessions_processed = true;
    } catch (e) {
      results.ppc_sessions_processed = false;
    }

    // 10. Smart notification rules
    const notifRules = await base44.asServiceRole.entities.SmartNotificationRule.filter({ is_active: true });
    results.active_notification_rules = notifRules.length;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});