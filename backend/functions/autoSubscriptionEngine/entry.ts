import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

// Automates: subscription renewals, expiry, downgrade, billing reminders, creator subscriptions
export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (user?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const results = {};
    const now = new Date().toISOString();
    const in3Days = new Date(Date.now() + 3 * 86400000).toISOString();

    // 1. Send renewal reminders (3 days before expiry)
    const expiringSubscriptions = await base44.asServiceRole.entities.Subscription.filter({ is_active: true });
    let reminders = 0;
    let expired = 0;
    let renewed = 0;
    for (const sub of expiringSubscriptions) {
      if (!sub.end_date) continue;
      const endDate = new Date(sub.end_date);
      const now_ = new Date();
      const daysUntilExpiry = (endDate - now_) / 86400000;

      if (daysUntilExpiry <= 0) {
        // Expired
        if (sub.auto_renew) {
          // Auto-renew: extend by 30 days
          await base44.asServiceRole.entities.Subscription.update(sub.id, {
            end_date: new Date(endDate.getTime() + 30 * 86400000).toISOString(),
            updated_at: now
          });
          renewed++;
        } else {
          // Deactivate
          await base44.asServiceRole.entities.Subscription.update(sub.id, {
            is_active: false,
            expired_at: now
          });
          await base44.asServiceRole.entities.Notification.create({
            user_id: sub.user_id,
            type: 'subscription_expired',
            title: '⚠️ Subscription Expired',
            message: `Your ${sub.plan_type} subscription has expired. Renew to keep your benefits.`,
            is_read: false,
            created_at: now
          });
          expired++;
        }
      } else if (daysUntilExpiry <= 3) {
        // Send reminder
        await base44.asServiceRole.entities.Notification.create({
          user_id: sub.user_id,
          type: 'subscription_expiring',
          title: '⏰ Subscription Expiring Soon',
          message: `Your ${sub.plan_type} subscription expires in ${Math.ceil(daysUntilExpiry)} day(s). Renew now to avoid interruption.`,
          is_read: false,
          created_at: now
        });
        reminders++;
      }
    }
    results.renewal_reminders_sent = reminders;
    results.subscriptions_expired = expired;
    results.subscriptions_auto_renewed = renewed;

    // 2. Creator subscription tier management
    const creatorSubscriptionTiers = await base44.asServiceRole.entities.CreatorSubscriptionTier.list('-created_date', 50);
    results.creator_tiers_active = creatorSubscriptionTiers.length;

    // 3. Streamer subscriptions — check and process
    const streamerSubs = await base44.asServiceRole.entities.StreamerSubscription.filter({ status: 'active' });
    let streamerExpired = 0;
    for (const sub of streamerSubs) {
      if (sub.expires_at && new Date(sub.expires_at) < new Date()) {
        await base44.asServiceRole.entities.StreamerSubscription.update(sub.id, { status: 'expired' });
        streamerExpired++;
      }
    }
    results.streamer_subscriptions_expired = streamerExpired;

    // 4. Premium membership renewal check
    const premiumMemberships = await base44.asServiceRole.entities.PremiumMembership.filter({ status: 'active' });
    let premiumExpired = 0;
    for (const pm of premiumMemberships) {
      if (pm.expires_at && new Date(pm.expires_at) < new Date()) {
        await base44.asServiceRole.entities.PremiumMembership.update(pm.id, { status: 'expired' });
        premiumExpired++;
      }
    }
    results.premium_memberships_expired = premiumExpired;

    // 5. App store pricing sync
    const appStorePrices = await base44.asServiceRole.entities.AppStorePrice.list('-updated_date', 20);
    results.app_store_prices_tracked = appStorePrices.length;

    return Response.json({ success: true, results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});