import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';

// Scheduled daily: auto-generate and activate referral campaigns for top users
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Get top referrers
    const users = await base44.asServiceRole.entities.User.list('-total_earnings', 50);
    const platforms = ['instagram', 'twitter', 'facebook', 'tiktok', 'email'];

    let campaignsCreated = 0;

    for (const user of users.slice(0, 10)) {
      // Check if user already has an active campaign today
      const today = new Date().toISOString().split('T')[0];
      const existing = await base44.asServiceRole.entities.ReferralCampaign.filter({
        user_id: user.id,
        status: 'active'
      });
      if (existing.length > 0) continue;

      const platform = platforms[Math.floor(Math.random() * platforms.length)];

      const prompt = `You are an AI marketing expert. Generate a referral campaign for this GamerGain user.

User Stats:
- Name: ${user.full_name}
- Total Earnings: $${user.total_earnings || 0}
- Total Referrals: ${user.total_referrals || 0}
- Platform: ${platform}

Create a highly personalized, compelling campaign for this specific user. Make the promotional content ready-to-post.`;

      const campaign = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            campaign_name: { type: 'string' },
            description: { type: 'string' },
            promotional_content: { type: 'string' },
            audience_strategy: { type: 'string' },
            creative_ideas: { type: 'array', items: { type: 'string' } },
            posting_schedule: { type: 'string' }
          }
        }
      });

      await base44.asServiceRole.entities.ReferralCampaign.create({
        user_id: user.id,
        campaign_name: campaign.campaign_name,
        campaign_type: 'social_media',
        target_platform: platform,
        description: campaign.description,
        promotional_content: campaign.promotional_content,
        target_audience: campaign.audience_strategy,
        ai_generated: true,
        ai_suggestions: campaign,
        status: 'active',
        start_date: today
      });

      // Notify the user
      await base44.asServiceRole.entities.Notification.create({
        user_id: user.id,
        type: 'campaign',
        title: '🚀 AI Created a Campaign For You!',
        message: `Your new AI-generated campaign "${campaign.campaign_name}" is ready. Start sharing to earn more!`,
        is_read: false
      });

      campaignsCreated++;
    }

    return Response.json({ success: true, campaigns_created: campaignsCreated });
  } catch (error) {
    console.error('AI campaign automation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});