import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Daily: manage ReferralCampaign performance and trigger follow-up sequences
export default __handler(async (req) => {
  const base44 = createClientFromRequest(req);

  try {
    const results = [];
    const activeCampaigns = await base44.asServiceRole.entities.ReferralCampaign.filter({ status: 'active' });

    for (const campaign of activeCampaigns) {
      const daysSinceCreated = (new Date() - new Date(campaign.created_date)) / (1000 * 60 * 60 * 24);
      const conversions = campaign.conversions || 0;
      const clicks = campaign.clicks || 0;
      const convRate = clicks > 0 ? conversions / clicks : 0;

      // AI analysis of campaign performance
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this referral campaign performance:
Campaign: "${campaign.name || 'Referral Campaign'}"
Days active: ${Math.floor(daysSinceCreated)}
Clicks: ${clicks}, Conversions: ${conversions}, Conversion rate: ${(convRate * 100).toFixed(1)}%
Target: ${campaign.target_conversions || 10}

Should we: 1) Send re-engagement emails to non-converting leads, 2) Boost with extra incentive, or 3) Pause and optimize?
Respond with: action (reengagement|boost|pause|continue), reason (one sentence)`,
        response_json_schema: {
          type: 'object',
          properties: {
            action: { type: 'string' },
            reason: { type: 'string' }
          }
        }
      });

      if (analysis.action === 'reengagement') {
        // Create follow-up task
        await base44.asServiceRole.entities.ReferralFollowUp.create({
          campaign_id: campaign.id,
          user_id: campaign.user_id,
          follow_up_type: 'email',
          status: 'pending',
          scheduled_for: new Date().toISOString(),
          message: analysis.reason
        });
        await base44.asServiceRole.entities.Notification.create({
          user_id: campaign.user_id,
          type: 'campaign_update',
          title: `📧 Referral Campaign Re-engagement Triggered`,
          message: analysis.reason,
          is_read: false
        });
      } else if (analysis.action === 'pause') {
        await base44.asServiceRole.entities.ReferralCampaign.update(campaign.id, { status: 'paused' });
        await base44.asServiceRole.entities.Notification.create({
          user_id: campaign.user_id,
          type: 'campaign_paused',
          title: `⏸️ Referral Campaign Auto-Paused`,
          message: analysis.reason,
          is_read: false
        });
      }

      results.push({ campaign_id: campaign.id, action: analysis.action });
    }

    return Response.json({ ok: true, processed: results.length, results });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
});