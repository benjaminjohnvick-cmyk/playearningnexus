import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Find inactive users (no activity in last 30 days, but active in past 90)
    const allUsers = await base44.asServiceRole.entities.User.list('', 1000);
    
    const inactiveUsers = allUsers.filter(u => {
      const lastActivityDate = new Date(u.last_social_post_date || u.updated_date);
      return lastActivityDate < thirtyDaysAgo && lastActivityDate > ninetyDaysAgo;
    });

    // Track campaign metrics
    const campaignResults = {
      triggered: 0,
      success: 0,
      failed: 0,
      discountsCreated: 0,
      totalRevenueRecovered: 0,
      campaigns: []
    };

    for (const inactiveUser of inactiveUsers) {
      try {
        // Get user's historical engagement
        const userOrders = await base44.asServiceRole.entities.Order.filter({
          user_id: inactiveUser.id
        }, '-created_date', 10);

        const avgOrderValue = userOrders.length > 0 
          ? userOrders.reduce((sum, o) => sum + (o.amount || 0), 0) / userOrders.length 
          : 0;

        // Generate personalized discount code
        const discountCode = `COMEBACK-${inactiveUser.id.slice(0, 6).toUpperCase()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
        const discountPercent = avgOrderValue > 50 ? 20 : avgOrderValue > 20 ? 15 : 10;

        // Create discount code in database
        const promoCode = await base44.asServiceRole.entities.PromoCode.create({
          code: discountCode,
          discount_percent: discountPercent,
          discount_type: 'percentage',
          max_uses: 1,
          created_for_user: inactiveUser.id,
          description: `Re-engagement offer for ${inactiveUser.full_name}`,
          status: 'active',
          expires_at: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString()
        });

        // Use AI to generate personalized re-engagement message
        const personalizationPrompt = `Generate a brief, compelling re-engagement email subject line and opening sentence for a user named "${inactiveUser.full_name}" who hasn't been active for ~30 days. They've previously spent an average of $${avgOrderValue.toFixed(2)} per transaction. Include a sense of urgency. Format: { "subject": "...", "opening": "..." }`;

        const personalization = await base44.integrations.Core.InvokeLLM({
          prompt: personalizationPrompt,
          response_json_schema: {
            type: 'object',
            properties: {
              subject: { type: 'string' },
              opening: { type: 'string' }
            }
          }
        });

        // Trigger re-engagement email sequence
        await base44.functions.invoke('aiRetentionOptimizer', {
          userId: inactiveUser.id,
          reengagementType: 'inactivity',
          discountCode,
          discountPercent,
          personalization,
          expectedValue: avgOrderValue
        });

        // Log campaign
        const campaign = {
          userId: inactiveUser.id,
          userName: inactiveUser.full_name,
          discountCode,
          discountPercent,
          daysInactive: Math.floor((now - new Date(inactiveUser.last_social_post_date || inactiveUser.updated_date)) / (24 * 60 * 60 * 1000)),
          expectedValue: avgOrderValue,
          triggeredAt: now.toISOString(),
          status: 'sent'
        };

        campaignResults.campaigns.push(campaign);
        campaignResults.triggered++;
        campaignResults.discountsCreated++;

        // Create campaign record for tracking
        await base44.asServiceRole.entities.RetentionCampaign.create({
          user_id: inactiveUser.id,
          campaign_type: 'inactivity_reengagement',
          discount_code: discountCode,
          discount_percent: discountPercent,
          expected_recovery_value: avgOrderValue,
          email_subject: personalization.subject,
          status: 'sent',
          sent_date: now.toISOString(),
          tracked: true
        });

      } catch (error) {
        campaignResults.failed++;
      }
    }

    // Calculate success metrics from historical campaigns
    const historicalCampaigns = await base44.asServiceRole.entities.RetentionCampaign.filter({
      campaign_type: 'inactivity_reengagement'
    }, '-sent_date', 100);

    const successfulCampaigns = historicalCampaigns.filter(c => c.converted === true);
    const successRate = historicalCampaigns.length > 0 
      ? (successfulCampaigns.length / historicalCampaigns.length * 100).toFixed(2)
      : 0;

    const totalRecovered = successfulCampaigns.reduce((sum, c) => sum + (c.expected_recovery_value || 0), 0);

    // Store overall metrics
    await base44.asServiceRole.entities.AutomationReview.create({
      automation_name: 'Inactivity Reengagement Engine',
      automation_type: 'retention',
      entity_id: 'inactivity_reengagement',
      entity_type: 'User',
      ai_recommendation: {
        campaignsTriggered: campaignResults.triggered,
        successRate: successRate,
        totalRecovered: totalRecovered,
        averageRecoveryValue: totalRecovered / (successfulCampaigns.length || 1),
        nextRun: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
      },
      ai_confidence: Math.min(95, 50 + (successRate * 0.5)),
      status: 'completed'
    });

    return Response.json({
      success: true,
      campaignMetrics: {
        triggered: campaignResults.triggered,
        discountsCreated: campaignResults.discountsCreated,
        historicalSuccessRate: successRate,
        totalRecovered,
        campaigns: campaignResults.campaigns
      }
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});