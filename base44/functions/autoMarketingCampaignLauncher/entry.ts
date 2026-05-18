import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Hourly: launch scheduled MarketingCampaigns and EmailMarketingFlows
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const now = new Date();
    const results = [];

    const campaigns = await base44.asServiceRole.entities.MarketingCampaign.filter({ status: 'scheduled' });
    for (const campaign of campaigns) {
      const scheduledAt = new Date(campaign.scheduled_date || campaign.start_date);
      if (scheduledAt <= now) {
        await base44.asServiceRole.entities.MarketingCampaign.update(campaign.id, { status: 'active', launched_at: now.toISOString() });

        // Generate AI content if not set
        if (!campaign.content) {
          const content = await base44.integrations.Core.InvokeLLM({
            prompt: `Write a compelling ${campaign.campaign_type || 'promotional'} marketing message for a gaming rewards platform. Campaign: "${campaign.name}". Target: ${campaign.target_audience || 'all gamers'}. Max 3 sentences, energetic and actionable.`
          });
          await base44.asServiceRole.entities.MarketingCampaign.update(campaign.id, { content });
        }

        // Trigger email flow if linked
        if (campaign.email_flow_id) {
          const flows = await base44.asServiceRole.entities.EmailMarketingFlow.filter({ id: campaign.email_flow_id });
          if (flows.length > 0) {
            await base44.asServiceRole.entities.EmailMarketingFlow.update(flows[0].id, { status: 'active', triggered_at: now.toISOString() });
          }
        }

        // Generate social media posts
        const platforms = ['twitter', 'facebook'];
        for (const platform of platforms) {
          await base44.asServiceRole.entities.SocialMediaPost.create({
            developer_id: campaign.created_by || 'system',
            platform,
            content: campaign.content || `🎮 ${campaign.name} — Join GamerGain and start earning today!`,
            hashtags: ['GamerGain', 'EarnWhileYouPlay', 'GameRewards'],
            scheduled_date: now.toISOString(),
            status: 'scheduled',
            post_type: 'promotional'
          });
        }

        results.push(campaign.id);
      }
    }

    // Also expire old campaigns
    const activeCampaigns = await base44.asServiceRole.entities.MarketingCampaign.filter({ status: 'active' });
    for (const campaign of activeCampaigns) {
      const endDate = campaign.end_date ? new Date(campaign.end_date) : null;
      if (endDate && endDate < now) {
        await base44.asServiceRole.entities.MarketingCampaign.update(campaign.id, { status: 'completed' });
      }
    }

    return Response.json({ ok: true, launched: results.length });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});