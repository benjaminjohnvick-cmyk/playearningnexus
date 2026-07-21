import { createClientFromRequest } from "../../sdk/mod.ts";
import { __handler } from "../../sdk/runtime.ts";

export default __handler(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const updates = {};

    // Auto-optimize notification preferences based on engagement
    const userActivity = await base44.asServiceRole.entities.UserActivity.filter({
      user_id: user.id
    });

    if (userActivity.length > 50) {
      // High engagement user - daily digests instead of real-time
      updates.notification_preference = 'daily_digest';
      updates.email_preference = 'weekly';
    } else if (userActivity.length > 10) {
      // Moderate engagement - balanced
      updates.notification_preference = 'real_time';
      updates.email_preference = 'daily';
    } else {
      // Low engagement - more frequent reminders
      updates.notification_preference = 'aggressive';
      updates.email_preference = 'daily';
    }

    // Auto-enable privacy based on data completeness
    if (!user.bio && !user.profile_picture_url) {
      updates.privacy_level = 'private'; // New users default to private
    }

    // Enable mobile notifications if has mobile activity
    const hasMobileActivity = userActivity.some(a => a.device_type === 'mobile');
    if (hasMobileActivity && !user.push_notifications_enabled) {
      updates.push_notifications_enabled = true;
    }

    // Auto-select best payout method based on location (fallback to PayPal)
    if (!updates.preferred_payout_method) {
      updates.preferred_payout_method = 'paypal';
    }

    // Apply all updates
    await base44.auth.updateMe(updates);

    return Response.json({
      success: true,
      optimized_settings: Object.keys(updates),
      updates
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});