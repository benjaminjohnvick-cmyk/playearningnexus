import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Get user's push subscriptions
    const subscriptions = await base44.asServiceRole.entities.PushSubscription.filter({
      user_id: user.id,
      is_active: true
    }).catch(() => []);

    if (subscriptions.length === 0) {
      return Response.json({ message: 'No active subscriptions' }, { status: 200 });
    }

    // Get relevant ads based on user's recent search history
    const recentSearches = await base44.asServiceRole.entities.UserActivity.filter({
      user_id: user.id,
      activity_type: 'ppc_search'
    }).catch(() => []);

    const latestSearch = recentSearches[recentSearches.length - 1];
    const searchQuery = latestSearch?.metadata?.search_query || 'exciting new offers';

    // Generate matching ads via AI
    const adMatches = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate 1-2 compelling push notification titles for PPC ads based on search: "${searchQuery}". 
      Keep titles under 50 chars, action-oriented, and include potential reward amount.
      Return JSON: { "notifications": [{ "title": "...", "body": "..." }] }`,
      response_json_schema: {
        type: 'object',
        properties: {
          notifications: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                body: { type: 'string' }
              }
            }
          }
        }
      }
    });

    // Send push notifications to all active subscriptions
    const results = [];
    for (const subscription of subscriptions) {
      try {
        // In a real implementation, you would use the Web Push API
        // For now, we'll simulate the notification sending
        const notification = adMatches.notifications[0];
        
        // Log the notification for analytics
        await base44.asServiceRole.entities.Notification.create({
          user_id: user.id,
          title: notification.title,
          message: notification.body,
          type: 'ppc_ad',
          icon_url: 'https://img.icons8.com/color/96/000000/push-notifications.png',
          action_url: `/PPCMarketplace?search=${encodeURIComponent(searchQuery)}`,
          status: 'sent',
          sent_at: new Date().toISOString()
        });

        results.push({ subscription_id: subscription.id, sent: true });
      } catch (error) {
        results.push({ subscription_id: subscription.id, sent: false, error: error.message });
      }
    }

    return Response.json({
      success: true,
      notifications_sent: results.filter(r => r.sent).length,
      total_subscriptions: subscriptions.length,
      results
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});