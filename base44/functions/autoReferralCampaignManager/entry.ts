import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// Auto-creates and manages referral campaigns for every user
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const users = await base44.asServiceRole.entities.User.list('-created_date', 300);
    let created = 0;
    let refreshed = 0;

    for (const user of users) {
      // Ensure every user has an active referral campaign
      const existing = await base44.asServiceRole.entities.ReferralCampaign.filter({ user_id: user.id, status: 'active' });
      if (existing.length > 0) {
        // Refresh stale campaigns (no clicks in 14 days)
        for (const campaign of existing) {
          const lastActivity = campaign.updated_date || campaign.created_date;
          const daysSince = (Date.now() - new Date(lastActivity)) / (1000 * 60 * 60 * 24);
          if (daysSince > 14) {
            const { InvokeLLM } = base44.asServiceRole.integrations.Core;
            const newCopy = await InvokeLLM({
              prompt: `Generate a fresh, compelling referral campaign message for a gaming rewards app (GamerGain).
User name: ${user.full_name || 'Gamer'}
Keep it under 280 characters. Make it exciting. Include the hook "earn real cash playing games".
Return just the message text, no quotes.`
            });
            await base44.asServiceRole.entities.ReferralCampaign.update(campaign.id, {
              message: newCopy,
              updated_date: new Date().toISOString(),
            });
            refreshed++;
          }
        }
        continue;
      }

      // Generate referral code
      const code = `${(user.full_name || 'user').replace(/\s+/g, '').toUpperCase().slice(0, 6)}${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

      const { InvokeLLM } = base44.asServiceRole.integrations.Core;
      const message = await InvokeLLM({
        prompt: `Generate a short compelling referral invite message for GamerGain (gaming rewards app).
The user's name is ${user.full_name || 'a gamer'}. Include "use my code ${code}". Under 200 characters. No quotes.`
      });

      await base44.asServiceRole.entities.ReferralCampaign.create({
        user_id: user.id,
        referral_code: code,
        campaign_name: `${user.full_name || 'User'}'s GamerGain Campaign`,
        message,
        status: 'active',
        platform: 'all',
        auto_generated: true,
      });
      created++;
    }

    return Response.json({ success: true, created, refreshed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});